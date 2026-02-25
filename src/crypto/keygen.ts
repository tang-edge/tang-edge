// SPDX-License-Identifier: GPL-3.0-only
// Copyright (c) tang-edge contributors

import { p521 } from "@noble/curves/nist.js";
import type { ECPrivateJWK } from "../storage/types";
import { bigintToBase64url } from "./jwk-utils";

function bytesToBigint(bytes: Uint8Array): bigint {
  let hex = "";
  for (const b of bytes) hex += b.toString(16).padStart(2, "0");
  return BigInt("0x" + hex);
}

/** Generate an ES512 signing key (P-521 ECDSA) */
export function generateSigningKey(): ECPrivateJWK {
  const privateKey = p521.utils.randomSecretKey();
  const publicKey = p521.getPublicKey(privateKey);
  const point = p521.Point.fromBytes(publicKey).toAffine();
  const d = bytesToBigint(privateKey);

  return {
    kty: "EC",
    crv: "P-521",
    x: bigintToBase64url(point.x),
    y: bigintToBase64url(point.y),
    d: bigintToBase64url(d),
    alg: "ES512",
    key_ops: ["sign", "verify"],
  };
}

/** Generate an ECMR exchange key (P-521 for key derivation) */
export function generateExchangeKey(): ECPrivateJWK {
  const privateKey = p521.utils.randomSecretKey();
  const publicKey = p521.getPublicKey(privateKey);
  const point = p521.Point.fromBytes(publicKey).toAffine();
  const d = bytesToBigint(privateKey);

  return {
    kty: "EC",
    crv: "P-521",
    x: bigintToBase64url(point.x),
    y: bigintToBase64url(point.y),
    d: bigintToBase64url(d),
    alg: "ECMR",
    key_ops: ["deriveKey"],
  };
}
