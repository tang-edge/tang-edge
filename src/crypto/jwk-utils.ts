// SPDX-License-Identifier: GPL-3.0-only
// Copyright (c) tang-edge contributors

import type { ECPublicJWK, TangJWK } from "../storage/types";

// Supported thumbprint hash algorithms
// Note: SHA-224 excluded — not available in Cloudflare Workers runtime
const HASH_ALGORITHMS: Record<string, string> = {
  S1: "SHA-1",
  S256: "SHA-256",
  S384: "SHA-384",
  S512: "SHA-512",
};

export const DEFAULT_THP_ALG = "S256";

export function isSupportedHash(alg: string): boolean {
  return alg in HASH_ALGORITHMS;
}

export function supportedHashes(): string[] {
  return Object.keys(HASH_ALGORITHMS);
}

// Base64url encode/decode
export function base64urlEncode(data: Uint8Array): string {
  let binary = "";
  for (const byte of data) binary += String.fromCodePoint(byte);
  const base64 = btoa(binary);
  return base64.replaceAll("+", "-").replaceAll("/", "_").replaceAll("=", "");
}

export function base64urlDecode(str: string): Uint8Array {
  const padded = str + "=".repeat((4 - (str.length % 4)) % 4);
  const base64 = padded.replaceAll("-", "+").replaceAll("_", "/");
  const binary = atob(base64);
  return Uint8Array.from(binary, (c) => c.codePointAt(0)!);
}

// BigInt <-> base64url with fixed byte length for P-521 (66 bytes)
const P521_COORD_LEN = 66;

export function bigintToBase64url(n: bigint, byteLen = P521_COORD_LEN): string {
  let hex = n.toString(16);
  if (hex.length % 2) hex = "0" + hex;
  while (hex.length < byteLen * 2) hex = "00" + hex;
  const bytes = new Uint8Array(hex.match(/.{2}/g)!.map((b) => Number.parseInt(b, 16)));
  return base64urlEncode(bytes);
}

export function base64urlToBigint(str: string): bigint {
  const bytes = base64urlDecode(str);
  let hex = "";
  for (const b of bytes) hex += b.toString(16).padStart(2, "0");
  return BigInt("0x" + hex);
}

/**
 * Compute JWK thumbprint per RFC 7638.
 * For EC keys, canonical form is: {"crv":"...","kty":"...","x":"...","y":"..."}
 */
export async function jwkThumbprint(
  jwk: TangJWK,
  alg: string = DEFAULT_THP_ALG,
): Promise<string> {
  const hashName = HASH_ALGORITHMS[alg];
  if (!hashName) throw new Error(`Unsupported hash algorithm: ${alg}`);

  // RFC 7638: members sorted lexicographically
  const canonical = JSON.stringify({
    crv: jwk.crv,
    kty: jwk.kty,
    x: jwk.x,
    y: jwk.y,
  });

  const data = new TextEncoder().encode(canonical);
  const hash = await crypto.subtle.digest(hashName, data);
  return base64urlEncode(new Uint8Array(hash));
}

/** Remove private key material, returning public-only JWK */
export function jwkPublic(jwk: TangJWK): ECPublicJWK {
  return {
    kty: jwk.kty,
    crv: jwk.crv,
    x: jwk.x,
    y: jwk.y,
    ...(jwk.alg && { alg: jwk.alg }),
    ...(jwk.key_ops && { key_ops: jwk.key_ops }),
  };
}

/** Check if JWK is valid for a specific operation */
export function jwkValidFor(jwk: TangJWK, use: string): boolean {
  if (!jwk.key_ops) return false;
  return jwk.key_ops.includes(use);
}

export function isValidForSigning(jwk: TangJWK): boolean {
  return jwkValidFor(jwk, "sign") && jwkValidFor(jwk, "verify");
}

export function isValidForDeriving(jwk: TangJWK): boolean {
  return jwkValidFor(jwk, "deriveKey");
}
