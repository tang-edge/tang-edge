export interface ECPublicJWK {
  kty: "EC";
  crv: "P-521";
  x: string;
  y: string;
  alg?: string;
  key_ops?: string[];
}

export interface ECPrivateJWK extends ECPublicJWK {
  d: string;
}

export type TangJWK = ECPublicJWK | ECPrivateJWK;

export function hasPrivateKey(jwk: TangJWK): jwk is ECPrivateJWK {
  return "d" in jwk;
}

export interface TangKeysInfo {
  keys: ECPrivateJWK[];
  rotatedKeys: ECPrivateJWK[];
  payload: ECPublicJWK[];
  sign: ECPrivateJWK[];
}

export interface JWSSignature {
  protected: string;
  signature: string;
}

export interface TangJWS {
  payload: string;
  signatures: JWSSignature[];
}

import type { TangStorage } from "./interface";

export interface Env {
  TANG_KEYS: TangStorage;
  ROTATE_TOKEN?: string;
}
