// SPDX-License-Identifier: GPL-3.0-only
// Copyright (c) tang-edge contributors

import { describe, it, expect } from "vitest";
import { p521 } from "@noble/curves/nist.js";
import { generateSigningKey, generateExchangeKey } from "../../src/crypto/keygen";
import { base64urlToBigint } from "../../src/crypto/jwk-utils";

describe("generateSigningKey", () => {
  it("generates valid ES512 signing key", () => {
    const key = generateSigningKey();

    expect(key.kty).toBe("EC");
    expect(key.crv).toBe("P-521");
    expect(key.alg).toBe("ES512");
    expect(key.key_ops).toEqual(["sign", "verify"]);
    expect(key.x).toBeTruthy();
    expect(key.y).toBeTruthy();
    expect(key.d).toBeTruthy();
  });

  it("generates point on the P-521 curve", () => {
    const key = generateSigningKey();
    const x = base64urlToBigint(key.x);
    const y = base64urlToBigint(key.y);

    const point = p521.Point.fromAffine({ x, y });
    expect(() => point.assertValidity()).not.toThrow();
  });

  it("generates unique keys each time", () => {
    const key1 = generateSigningKey();
    const key2 = generateSigningKey();

    expect(key1.d).not.toBe(key2.d);
    expect(key1.x).not.toBe(key2.x);
  });
});

describe("generateExchangeKey", () => {
  it("generates valid ECMR exchange key", () => {
    const key = generateExchangeKey();

    expect(key.kty).toBe("EC");
    expect(key.crv).toBe("P-521");
    expect(key.alg).toBe("ECMR");
    expect(key.key_ops).toEqual(["deriveKey"]);
    expect(key.x).toBeTruthy();
    expect(key.y).toBeTruthy();
    expect(key.d).toBeTruthy();
  });

  it("generates point on the P-521 curve", () => {
    const key = generateExchangeKey();
    const x = base64urlToBigint(key.x);
    const y = base64urlToBigint(key.y);

    const point = p521.Point.fromAffine({ x, y });
    expect(() => point.assertValidity()).not.toThrow();
  });

  it("private key derives to the public key", () => {
    const key = generateExchangeKey();
    const d = base64urlToBigint(key.d);

    // G * d should equal the public key
    const derivedPoint = p521.Point.BASE.multiply(d).toAffine();

    expect(base64urlToBigint(key.x)).toBe(derivedPoint.x);
    expect(base64urlToBigint(key.y)).toBe(derivedPoint.y);
  });
});
