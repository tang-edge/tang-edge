// SPDX-License-Identifier: GPL-3.0-only
// Copyright (c) tang-edge contributors

import { describe, it, expect } from "vitest";
import {
  base64urlEncode,
  base64urlDecode,
  bigintToBase64url,
  base64urlToBigint,
  jwkThumbprint,
  jwkPublic,
  isValidForSigning,
  isValidForDeriving,
  isSupportedHash,
  supportedHashes,
  DEFAULT_THP_ALG,
} from "../../src/crypto/jwk-utils";
import type { ECPublicJWK, ECPrivateJWK } from "../../src/storage/types";

describe("base64url", () => {
  it("encodes and decodes correctly", () => {
    const data = new Uint8Array([72, 101, 108, 108, 111]); // "Hello"
    const encoded = base64urlEncode(data);
    expect(encoded).toBe("SGVsbG8");
    const decoded = base64urlDecode(encoded);
    expect(decoded).toEqual(data);
  });

  it("handles empty data", () => {
    const data = new Uint8Array([]);
    const encoded = base64urlEncode(data);
    const decoded = base64urlDecode(encoded);
    expect(decoded).toEqual(data);
  });

  it("handles base64url special characters (no +/=)", () => {
    const data = new Uint8Array([255, 254, 253]);
    const encoded = base64urlEncode(data);
    expect(encoded).not.toContain("+");
    expect(encoded).not.toContain("/");
    expect(encoded).not.toContain("=");
  });
});

describe("bigint base64url", () => {
  it("roundtrips bigint correctly", () => {
    const n = BigInt("0x0102030405060708090a0b0c0d0e0f");
    const encoded = bigintToBase64url(n, 15);
    const decoded = base64urlToBigint(encoded);
    expect(decoded).toBe(n);
  });

  it("pads to correct byte length for P-521 (66 bytes)", () => {
    const n = BigInt(42);
    const encoded = bigintToBase64url(n);
    const decoded = base64urlDecode(encoded);
    expect(decoded.length).toBe(66);
    expect(decoded[65]).toBe(42);
    expect(decoded[0]).toBe(0);
  });
});

describe("isSupportedHash", () => {
  it("accepts valid hash algorithms", () => {
    expect(isSupportedHash("S1")).toBe(true);
    expect(isSupportedHash("S256")).toBe(true);
    expect(isSupportedHash("S384")).toBe(true);
    expect(isSupportedHash("S512")).toBe(true);
  });

  it("rejects invalid hash algorithms", () => {
    expect(isSupportedHash("")).toBe(false);
    expect(isSupportedHash("S224")).toBe(false);
    expect(isSupportedHash("ES512")).toBe(false);
    expect(isSupportedHash("ECMR")).toBe(false);
    expect(isSupportedHash("foobar")).toBe(false);
    expect(isSupportedHash("S42")).toBe(false);
  });
});

describe("supportedHashes", () => {
  it("returns all 4 hash algorithms", () => {
    const hashes = supportedHashes();
    expect(hashes).toContain("S1");
    expect(hashes).toContain("S256");
    expect(hashes).toContain("S384");
    expect(hashes).toContain("S512");
    expect(hashes).toHaveLength(4);
  });
});

describe("DEFAULT_THP_ALG", () => {
  it("is S256", () => {
    expect(DEFAULT_THP_ALG).toBe("S256");
  });
});

const testSigningKey: ECPrivateJWK = {
  kty: "EC",
  crv: "P-521",
  x: "test-x",
  y: "test-y",
  d: "test-d",
  alg: "ES512",
  key_ops: ["sign", "verify"],
};

const testExchangeKey: ECPrivateJWK = {
  kty: "EC",
  crv: "P-521",
  x: "test-x2",
  y: "test-y2",
  d: "test-d2",
  alg: "ECMR",
  key_ops: ["deriveKey"],
};

describe("jwkPublic", () => {
  it("removes private key material", () => {
    const pub = jwkPublic(testSigningKey);
    expect(pub).not.toHaveProperty("d");
    expect(pub.kty).toBe("EC");
    expect(pub.crv).toBe("P-521");
    expect(pub.x).toBe("test-x");
    expect(pub.y).toBe("test-y");
    expect(pub.alg).toBe("ES512");
    expect(pub.key_ops).toEqual(["sign", "verify"]);
  });
});

describe("isValidForSigning", () => {
  it("returns true for signing key", () => {
    expect(isValidForSigning(testSigningKey)).toBe(true);
  });

  it("returns false for exchange key", () => {
    expect(isValidForSigning(testExchangeKey)).toBe(false);
  });

  it("returns false for key without key_ops", () => {
    const key: ECPublicJWK = { kty: "EC", crv: "P-521", x: "x", y: "y" };
    expect(isValidForSigning(key)).toBe(false);
  });
});

describe("isValidForDeriving", () => {
  it("returns true for exchange key", () => {
    expect(isValidForDeriving(testExchangeKey)).toBe(true);
  });

  it("returns false for signing key", () => {
    expect(isValidForDeriving(testSigningKey)).toBe(false);
  });
});

describe("jwkThumbprint", () => {
  it("computes deterministic thumbprint", async () => {
    const key: ECPublicJWK = {
      kty: "EC",
      crv: "P-521",
      x: "AHKZLLOsCOzz5cY97ewNUajB957y-C-U88c3v13nmGZx6sYl_oJXu9A5RkTKqjqvjyekWF-7ytDyRXYgCF5cj0Kt",
      y: "AdymlHvOiLxXkEhayXQnNCvDX4h9htZaCJN34kfmC6pV5OhQHiraVySsUdaQkAgDPrwQrJmbnX9cwlGfP-HqHZR1",
    };

    const thp1 = await jwkThumbprint(key, "S256");
    const thp2 = await jwkThumbprint(key, "S256");
    expect(thp1).toBe(thp2);
    expect(thp1.length).toBeGreaterThan(0);
  });

  it("different algorithms produce different thumbprints", async () => {
    const key: ECPublicJWK = {
      kty: "EC",
      crv: "P-521",
      x: "AHKZLLOsCOzz5cY97ewNUajB957y-C-U88c3v13nmGZx6sYl_oJXu9A5RkTKqjqvjyekWF-7ytDyRXYgCF5cj0Kt",
      y: "AdymlHvOiLxXkEhayXQnNCvDX4h9htZaCJN34kfmC6pV5OhQHiraVySsUdaQkAgDPrwQrJmbnX9cwlGfP-HqHZR1",
    };

    const thp256 = await jwkThumbprint(key, "S256");
    const thp512 = await jwkThumbprint(key, "S512");
    expect(thp256).not.toBe(thp512);
  });

  it("throws for unsupported algorithm", async () => {
    const key: ECPublicJWK = { kty: "EC", crv: "P-521", x: "x", y: "y" };
    await expect(jwkThumbprint(key, "INVALID")).rejects.toThrow();
  });
});
