// SPDX-License-Identifier: GPL-3.0-only
// Copyright (c) tang-edge contributors

import { describe, it, expect, beforeEach } from "vitest";
import { app } from "../../src/index";
import { saveKey, rotateKey } from "../../src/storage/kv-store";
import { generateSigningKey, generateExchangeKey } from "../../src/crypto/keygen";
import { jwkThumbprint, base64urlDecode } from "../../src/crypto/jwk-utils";
import { createMockKV } from "../helpers/mock-kv";
import type { TangStorage } from "../../src/storage/interface";

interface JWSResponse {
  payload: string;
  signatures: { protected: string; signature: string }[];
}

describe("GET /adv", () => {
  let kv: TangStorage;
  let env: { TANG_KEYS: TangStorage };

  beforeEach(() => {
    kv = createMockKV();
    env = { TANG_KEYS: kv };
  });

  it("returns JWS advertisement with auto-generated keys", async () => {
    const res = await app.fetch(new Request("http://localhost/adv"), env);
    expect(res.status).toBe(200);

    const jws = (await res.json()) as JWSResponse;
    expect(jws.payload).toBeTruthy();
    expect(jws.signatures).toBeTruthy();
    expect(jws.signatures.length).toBeGreaterThan(0);
  });

  it("returns Content-Type application/jose+json", async () => {
    const res = await app.fetch(new Request("http://localhost/adv"), env);
    expect(res.headers.get("content-type")).toContain("application/jose+json");
  });

  it("payload contains public keys without private material", async () => {
    const sigKey = generateSigningKey();
    const excKey = generateExchangeKey();
    await saveKey(kv, sigKey);
    await saveKey(kv, excKey);

    const res = await app.fetch(new Request("http://localhost/adv"), env);
    const jws = (await res.json()) as JWSResponse;

    const payloadJson = new TextDecoder().decode(base64urlDecode(jws.payload));
    const payload = JSON.parse(payloadJson);

    expect(payload.keys.length).toBeGreaterThan(0);
    for (const key of payload.keys) {
      expect(key).not.toHaveProperty("d");
    }
  });

  it("returns JWS signed by signing key when thumbprint provided", async () => {
    const sigKey = generateSigningKey();
    const excKey = generateExchangeKey();
    await saveKey(kv, sigKey);
    await saveKey(kv, excKey);

    const thp = await jwkThumbprint(sigKey, "S256");
    const res = await app.fetch(
      new Request(`http://localhost/adv/${thp}`),
      env,
    );
    expect(res.status).toBe(200);

    const jws = (await res.json()) as JWSResponse;
    expect(jws.signatures.length).toBeGreaterThanOrEqual(1);
  });

  it("returns 404 for non-existent thumbprint", async () => {
    const sigKey = generateSigningKey();
    await saveKey(kv, sigKey);

    const res = await app.fetch(
      new Request("http://localhost/adv/nonexistent-thumbprint"),
      env,
    );
    expect(res.status).toBe(404);
  });

  it("returns 500 when storage has no keys and ensureKeys fails", async () => {
    // Storage where put is a no-op so ensureKeys can't create keys
    const brokenKv: TangStorage = {
      get: async () => null,
      put: async () => {},
      delete: async () => {},
      list: async () => ({ keys: [] }),
    };
    const brokenEnv = { TANG_KEYS: brokenKv };

    const res = await app.fetch(new Request("http://localhost/adv"), brokenEnv);
    expect(res.status).toBe(500);
  });

  it("returns 500 on /adv/:thp when storage has no keys", async () => {
    const brokenKv: TangStorage = {
      get: async () => null,
      put: async () => {},
      delete: async () => {},
      list: async () => ({ keys: [] }),
    };
    const brokenEnv = { TANG_KEYS: brokenKv };

    const res = await app.fetch(
      new Request("http://localhost/adv/some-thp"),
      brokenEnv,
    );
    expect(res.status).toBe(500);
  });

  it("adds rotated signing key as extra signer on /adv/:thp", async () => {
    const sigKey = generateSigningKey();
    const excKey = generateExchangeKey();
    const sigThp = await saveKey(kv, sigKey);
    await saveKey(kv, excKey);

    // Rotate the original signing key and create new active keys
    await rotateKey(kv, `${sigThp}.jwk`);
    const newSigKey = generateSigningKey();
    const newExcKey = generateExchangeKey();
    await saveKey(kv, newSigKey);
    await saveKey(kv, newExcKey);

    // Request with rotated signing key's thumbprint
    const thp = await jwkThumbprint(sigKey, "S256");
    const res = await app.fetch(
      new Request(`http://localhost/adv/${thp}`),
      env,
    );
    expect(res.status).toBe(200);

    const jws = (await res.json()) as JWSResponse;
    // Should have signatures from both the active signer AND the rotated signer
    expect(jws.signatures.length).toBeGreaterThanOrEqual(2);
  });

  it("returns 404 for exchange key thumbprint (not signing)", async () => {
    const sigKey = generateSigningKey();
    const excKey = generateExchangeKey();
    await saveKey(kv, sigKey);
    await saveKey(kv, excKey);

    const excThp = await jwkThumbprint(excKey, "S256");
    const res = await app.fetch(
      new Request(`http://localhost/adv/${excThp}`),
      env,
    );
    expect(res.status).toBe(404);
  });
});
