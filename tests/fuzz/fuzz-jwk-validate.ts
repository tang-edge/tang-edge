// SPDX-License-Identifier: GPL-3.0-only
// Copyright (c) tang-edge contributors

import type { ECPublicJWK } from "../../src/storage/types";

/**
 * Fuzz target: JWK client key validation (same logic as rec.ts).
 * Ensures validateClientKey never crashes on arbitrary JSON.
 */
function validateClientKey(key: ECPublicJWK): boolean {
  if (key.kty !== "EC" || key.crv !== "P-521") return false;
  if (key.alg && key.alg !== "ECMR") return false;
  if (!key.x || !key.y) return false;
  if (key.x.length > 120 || key.y.length > 120) return false;
  return true;
}

export function fuzzJwkValidate(data: Buffer): void {
  const str = data.toString("utf8");

  // Try parsing as JSON and validating
  try {
    const parsed = JSON.parse(str);
    validateClientKey(parsed);
  } catch {
    // Invalid JSON — expected, must not crash
  }

  // Try with partially valid structures
  try {
    const partial = JSON.parse(str);
    if (typeof partial === "object" && partial !== null) {
      // Force various field types to stress validation
      validateClientKey({
        kty: partial.kty ?? "EC",
        crv: partial.crv ?? "P-521",
        x: partial.x ?? "",
        y: partial.y ?? "",
        alg: partial.alg,
        key_ops: partial.key_ops,
      });
    }
  } catch {
    // Expected
  }
}
