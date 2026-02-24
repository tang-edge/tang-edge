import { describe, it, expect } from "vitest";
import { p521 } from "@noble/curves/nist.js";
import { ecmrExchange } from "../../src/crypto/ecmr";
import { generateExchangeKey } from "../../src/crypto/keygen";
import { base64urlToBigint, bigintToBase64url } from "../../src/crypto/jwk-utils";
import { jwkPublic } from "../../src/crypto/jwk-utils";
import type { ECPublicJWK, ECPrivateJWK } from "../../src/storage/types";

describe("ecmrExchange", () => {
  it("performs scalar multiplication correctly", () => {
    const serverKey = generateExchangeKey();
    const clientKey = generateExchangeKey();
    const clientPub = jwkPublic(clientKey);

    const result = ecmrExchange(serverKey, clientPub);

    // Verify result is a valid EC point
    expect(result.kty).toBe("EC");
    expect(result.crv).toBe("P-521");
    expect(result.alg).toBe("ECMR");
    expect(result.key_ops).toEqual(["deriveKey"]);
    expect(result.x).toBeTruthy();
    expect(result.y).toBeTruthy();

    // Verify no private key in result
    expect(result).not.toHaveProperty("d");
  });

  it("matches manual computation", () => {
    const serverKey = generateExchangeKey();
    const clientKey = generateExchangeKey();
    const clientPub = jwkPublic(clientKey);

    // Compute manually
    const clientX = base64urlToBigint(clientPub.x);
    const clientY = base64urlToBigint(clientPub.y);
    const clientPoint = p521.Point.fromAffine({ x: clientX, y: clientY });
    const serverD = base64urlToBigint(serverKey.d);
    const expectedPoint = clientPoint.multiply(serverD).toAffine();

    // Compute via ecmrExchange
    const result = ecmrExchange(serverKey, clientPub);

    expect(base64urlToBigint(result.x)).toBe(expectedPoint.x);
    expect(base64urlToBigint(result.y)).toBe(expectedPoint.y);
  });

  it("produces different results for different server keys", () => {
    const serverKey1 = generateExchangeKey();
    const serverKey2 = generateExchangeKey();
    const clientKey = generateExchangeKey();
    const clientPub = jwkPublic(clientKey);

    const result1 = ecmrExchange(serverKey1, clientPub);
    const result2 = ecmrExchange(serverKey2, clientPub);

    expect(result1.x).not.toBe(result2.x);
  });

  it("produces different results for different client keys", () => {
    const serverKey = generateExchangeKey();
    const clientKey1 = generateExchangeKey();
    const clientKey2 = generateExchangeKey();

    const result1 = ecmrExchange(serverKey, jwkPublic(clientKey1));
    const result2 = ecmrExchange(serverKey, jwkPublic(clientKey2));

    expect(result1.x).not.toBe(result2.x);
  });

  it("rejects server key with zero private scalar", () => {
    const clientKey = generateExchangeKey();
    const clientPub = jwkPublic(clientKey);
    const badServerKey: ECPrivateJWK = {
      ...generateExchangeKey(),
      d: bigintToBase64url(0n),
    };

    expect(() => ecmrExchange(badServerKey, clientPub)).toThrow();
  });

  it("rejects server key with scalar >= curve order", () => {
    const clientKey = generateExchangeKey();
    const clientPub = jwkPublic(clientKey);
    const curveOrder = p521.Point.CURVE().n;
    const badServerKey: ECPrivateJWK = {
      ...generateExchangeKey(),
      d: bigintToBase64url(curveOrder),
    };

    expect(() => ecmrExchange(badServerKey, clientPub)).toThrow();
  });

  it("rejects invalid client point (not on curve)", () => {
    const serverKey = generateExchangeKey();
    const badClient: ECPublicJWK = {
      kty: "EC",
      crv: "P-521",
      x: bigintToBase64url(BigInt(1)),
      y: bigintToBase64url(BigInt(2)), // Not a valid point
      key_ops: ["deriveKey"],
      alg: "ECMR",
    };

    expect(() => ecmrExchange(serverKey, badClient)).toThrow();
  });
});
