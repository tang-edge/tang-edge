// SPDX-License-Identifier: GPL-3.0-only
// Copyright (c) tang-edge contributors

import { p521 } from "@noble/curves/nist.js";
import type { ECPrivateJWK, TangJWK, TangJWS } from "../storage/types";
import { base64urlEncode, base64urlToBigint, jwkPublic } from "./jwk-utils";

/**
 * Sign an advertisement (JWK Set) with one or more signing keys.
 *
 * Produces a JWS General Serialization with:
 *   payload = base64url({"keys": [public_keys]})
 *   signatures[] = one per signing key, each with protected header {"alg":"ES512","cty":"jwk-set+json"}
 */
export async function signAdvertisement(
  payloadKeys: TangJWK[],
  signingKeys: ECPrivateJWK[],
): Promise<TangJWS> {
  const publicKeys = payloadKeys.map(jwkPublic);
  const payloadJson = JSON.stringify({ keys: publicKeys });
  const payloadB64 = base64urlEncode(new TextEncoder().encode(payloadJson));

  const protectedHeader = { alg: "ES512", cty: "jwk-set+json" };
  const protectedB64 = base64urlEncode(
    new TextEncoder().encode(JSON.stringify(protectedHeader)),
  );

  const signatures = await Promise.all(
    signingKeys.map(async (key) => {
      const sigInput = new TextEncoder().encode(`${protectedB64}.${payloadB64}`);
      const signature = await es512Sign(key, sigInput);
      return {
        protected: protectedB64,
        signature: base64urlEncode(signature),
      };
    }),
  );

  return { payload: payloadB64, signatures };
}

/**
 * ES512 signing using @noble/curves P-521.
 * Signs the data with ECDSA using SHA-512, returns the signature in JWS format (r || s, each 66 bytes).
 */
async function es512Sign(key: ECPrivateJWK, data: Uint8Array): Promise<Uint8Array> {
  const hash = await crypto.subtle.digest("SHA-512", data);

  const d = base64urlToBigint(key.d);
  let dHex = d.toString(16);
  if (dHex.length % 2) dHex = "0" + dHex;
  while (dHex.length < 132) dHex = "00" + dHex;
  const dBytes = new Uint8Array(dHex.match(/.{2}/g)!.map((b) => Number.parseInt(b, 16)));

  return p521.sign(new Uint8Array(hash), dBytes);
}
