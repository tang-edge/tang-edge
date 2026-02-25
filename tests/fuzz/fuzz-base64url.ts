// SPDX-License-Identifier: GPL-3.0-only
// Copyright (c) tang-edge contributors

import { base64urlEncode, base64urlDecode, base64urlToBigint, bigintToBase64url } from "../../src/crypto/jwk-utils";

/**
 * Fuzz target: base64url encode/decode roundtrip.
 * Ensures no crash on arbitrary input and roundtrip consistency.
 */
export function fuzzBase64url(data: Buffer): void {
  // Fuzz decode with arbitrary strings
  const str = data.toString("utf8");
  try {
    const decoded = base64urlDecode(str);
    // If decode succeeds, encode must roundtrip
    const reencoded = base64urlEncode(decoded);
    const redecoded = base64urlDecode(reencoded);
    if (decoded.length !== redecoded.length) {
      throw new Error("Roundtrip length mismatch");
    }
  } catch {
    // Invalid base64 input — expected, must not crash
  }

  // Fuzz encode with arbitrary bytes
  const bytes = new Uint8Array(data);
  const encoded = base64urlEncode(bytes);
  const roundtrip = base64urlDecode(encoded);
  if (bytes.length !== roundtrip.length) {
    throw new Error("Encode roundtrip length mismatch");
  }
  for (let i = 0; i < bytes.length; i++) {
    if (bytes[i] !== roundtrip[i]) {
      throw new Error(`Encode roundtrip byte mismatch at ${i}`);
    }
  }

  // Fuzz bigint conversion
  try {
    const n = base64urlToBigint(str);
    if (n >= 0n) {
      const back = bigintToBase64url(n);
      base64urlToBigint(back); // must not crash
    }
  } catch {
    // Invalid input — expected
  }
}
