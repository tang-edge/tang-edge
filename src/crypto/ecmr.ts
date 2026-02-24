import { p521 } from "@noble/curves/nist.js";
import type { ECPublicJWK, ECPrivateJWK } from "../storage/types";
import { base64urlToBigint, bigintToBase64url } from "./jwk-utils";

/**
 * ECMR Mode 1: Scalar multiplication (server-side key exchange).
 *
 * When the server has a private key, the ECMR exchange is equivalent to
 * standard ECDH: result = clientPublicPoint * serverPrivateScalar
 *
 * This is the only mode needed on the Tang server side.
 * Modes 2 (point addition) and 3 (point subtraction) happen client-side in clevis.
 */
export function ecmrExchange(
  serverKey: ECPrivateJWK,
  clientKey: ECPublicJWK,
): ECPublicJWK {
  // Decode client's public point from JWK coordinates
  const clientX = base64urlToBigint(clientKey.x);
  const clientY = base64urlToBigint(clientKey.y);
  const clientPoint = p521.Point.fromAffine({ x: clientX, y: clientY });

  // Validate the client point is on the curve
  clientPoint.assertValidity();

  // Decode and validate server's private scalar
  const serverD = base64urlToBigint(serverKey.d);
  if (serverD <= 0n || serverD >= p521.Point.CURVE().n) {
    throw new Error("Invalid server private key scalar");
  }

  // Scalar multiplication: result = clientPoint * serverD
  const resultPoint = clientPoint.multiply(serverD);
  const affine = resultPoint.toAffine();

  return {
    kty: "EC",
    crv: "P-521",
    x: bigintToBase64url(affine.x),
    y: bigintToBase64url(affine.y),
    key_ops: ["deriveKey"],
    alg: "ECMR",
  };
}
