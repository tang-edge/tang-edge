import { describe, it, expect } from "vitest";
import { p521 } from "@noble/curves/nist.js";
import { signAdvertisement } from "../../src/crypto/jws";
import { generateSigningKey, generateExchangeKey } from "../../src/crypto/keygen";
import { jwkPublic, base64urlDecode, base64urlToBigint } from "../../src/crypto/jwk-utils";

describe("signAdvertisement", () => {
  it("creates JWS with correct structure", async () => {
    const sigKey = generateSigningKey();
    const excKey = generateExchangeKey();

    const jws = await signAdvertisement(
      [jwkPublic(sigKey), jwkPublic(excKey)],
      [sigKey],
    );

    expect(jws.payload).toBeTruthy();
    expect(jws.signatures).toHaveLength(1);
    expect(jws.signatures[0].protected).toBeTruthy();
    expect(jws.signatures[0].signature).toBeTruthy();
  });

  it("payload contains public keys only", async () => {
    const sigKey = generateSigningKey();
    const excKey = generateExchangeKey();

    const jws = await signAdvertisement(
      [jwkPublic(sigKey), jwkPublic(excKey)],
      [sigKey],
    );

    const payloadJson = new TextDecoder().decode(base64urlDecode(jws.payload));
    const payload = JSON.parse(payloadJson);

    expect(payload.keys).toHaveLength(2);
    for (const key of payload.keys) {
      expect(key).not.toHaveProperty("d");
      expect(key.kty).toBe("EC");
      expect(key.crv).toBe("P-521");
    }
  });

  it("protected header contains correct alg and cty", async () => {
    const sigKey = generateSigningKey();

    const jws = await signAdvertisement([jwkPublic(sigKey)], [sigKey]);

    const headerJson = new TextDecoder().decode(
      base64urlDecode(jws.signatures[0].protected),
    );
    const header = JSON.parse(headerJson);

    expect(header.alg).toBe("ES512");
    expect(header.cty).toBe("jwk-set+json");
  });

  it("creates multiple signatures for multiple signing keys", async () => {
    const sigKey1 = generateSigningKey();
    const sigKey2 = generateSigningKey();
    const excKey = generateExchangeKey();

    const jws = await signAdvertisement(
      [jwkPublic(sigKey1), jwkPublic(sigKey2), jwkPublic(excKey)],
      [sigKey1, sigKey2],
    );

    expect(jws.signatures).toHaveLength(2);
  });

  it("signature is 132 bytes (ES512 format)", async () => {
    const sigKey = generateSigningKey();

    const jws = await signAdvertisement([jwkPublic(sigKey)], [sigKey]);

    const sigBytes = base64urlDecode(jws.signatures[0].signature);
    expect(sigBytes.length).toBe(132); // r (66) + s (66)
  });

  it("signature can be verified with noble/curves", async () => {
    const sigKey = generateSigningKey();
    const excKey = generateExchangeKey();

    const jws = await signAdvertisement(
      [jwkPublic(sigKey), jwkPublic(excKey)],
      [sigKey],
    );

    // Reconstruct the signed input
    const sigInput = new TextEncoder().encode(
      `${jws.signatures[0].protected}.${jws.payload}`,
    );
    const hash = await crypto.subtle.digest("SHA-512", sigInput);

    // Decode signature (compact r || s format, 132 bytes)
    const sigBytes = base64urlDecode(jws.signatures[0].signature);

    // Get public key as uncompressed bytes
    const pubX = base64urlToBigint(sigKey.x);
    const pubY = base64urlToBigint(sigKey.y);

    let xHex = pubX.toString(16);
    let yHex = pubY.toString(16);
    while (xHex.length < 132) xHex = "0" + xHex;
    while (yHex.length < 132) yHex = "0" + yHex;
    const pubHex = "04" + xHex + yHex;
    const pubBytes = new Uint8Array(pubHex.match(/.{2}/g)!.map((b) => parseInt(b, 16)));

    // Verify directly with raw bytes
    const valid = p521.verify(sigBytes, new Uint8Array(hash), pubBytes);
    expect(valid).toBe(true);
  });
});
