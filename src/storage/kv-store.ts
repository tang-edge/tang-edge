import type { ECPrivateJWK, TangKeysInfo } from "./types";
import type { TangStorage } from "./interface";
import {
  jwkThumbprint,
  jwkPublic,
  isValidForSigning,
  isValidForDeriving,
  supportedHashes,
  DEFAULT_THP_ALG,
} from "../crypto/jwk-utils";
import { generateSigningKey, generateExchangeKey } from "../crypto/keygen";

/** Load all keys from KV, separating active and rotated */
export async function loadKeys(kv: TangStorage): Promise<TangKeysInfo> {
  const result: TangKeysInfo = {
    keys: [],
    rotatedKeys: [],
    payload: [],
    sign: [],
  };

  const list = await kv.list();

  for (const key of list.keys) {
    const name = key.name;
    if (!name.endsWith(".jwk")) continue;

    const value = await kv.get(name);
    if (!value) continue;

    let jwk: ECPrivateJWK;
    try {
      jwk = JSON.parse(value);
    } catch {
      console.warn(`tang-edge: skipping ${name} — invalid JSON`);
      continue;
    }

    if (name.startsWith(".")) {
      result.rotatedKeys.push(jwk);
    } else {
      result.keys.push(jwk);
    }
  }

  // Populate payload and sign arrays
  for (const key of result.keys) {
    if (isValidForSigning(key)) {
      result.payload.push(jwkPublic(key));
      result.sign.push(key);
    } else if (isValidForDeriving(key)) {
      result.payload.push(jwkPublic(key));
    }
  }

  return result;
}

/** Save a JWK to KV by its thumbprint */
export async function saveKey(kv: TangStorage, jwk: ECPrivateJWK): Promise<string> {
  const thp = await jwkThumbprint(jwk, DEFAULT_THP_ALG);
  const name = `${thp}.jwk`;
  await kv.put(name, JSON.stringify(jwk));
  return thp;
}

/** Rotate a key: copy to .{thp}.jwk, delete original */
export async function rotateKey(kv: TangStorage, name: string): Promise<void> {
  if (name.startsWith(".")) return; // already rotated
  const value = await kv.get(name);
  if (!value) return;
  await kv.put(`.${name}`, value);
  await kv.delete(name);
}

/** Create new key pair if no active keys exist */
export async function ensureKeys(kv: TangStorage): Promise<TangKeysInfo> {
  let info = await loadKeys(kv);

  if (info.keys.length === 0) {
    const sigKey = generateSigningKey();
    const excKey = generateExchangeKey();
    await saveKey(kv, sigKey);
    await saveKey(kv, excKey);
    info = await loadKeys(kv);
  }

  return info;
}

/** Rotate all active keys and generate a new pair */
export async function rotateAllKeys(kv: TangStorage): Promise<TangKeysInfo> {
  // Generate new keys FIRST — ensures server always has active keys
  // even if the process crashes mid-rotation
  const sigKey = generateSigningKey();
  const excKey = generateExchangeKey();
  const newSigName = `${await saveKey(kv, sigKey)}.jwk`;
  const newExcName = `${await saveKey(kv, excKey)}.jwk`;

  // Now rotate old keys (safe — new keys already exist)
  const list = await kv.list();
  for (const key of list.keys) {
    if (key.name.endsWith(".jwk") && !key.name.startsWith(".")) {
      if (key.name === newSigName || key.name === newExcName) continue;
      await rotateKey(kv, key.name);
    }
  }

  return loadKeys(kv);
}

/** Find a key by thumbprint across all hash algorithms */
export async function findKeyByThumbprint(
  info: TangKeysInfo,
  thp: string,
): Promise<ECPrivateJWK | null> {
  const allKeys = [...info.keys, ...info.rotatedKeys];

  for (const key of allKeys) {
    for (const alg of supportedHashes()) {
      const computed = await jwkThumbprint(key, alg);
      if (computed === thp) return key;
    }
  }

  return null;
}
