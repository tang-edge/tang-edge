// SPDX-License-Identifier: GPL-3.0-only
// Copyright (c) tang-edge contributors

import { describe, it, expect, beforeEach } from "vitest";
import { app } from "../../src/index";
import { saveKey } from "../../src/storage/kv-store";
import { generateSigningKey, generateExchangeKey } from "../../src/crypto/keygen";
import { jwkThumbprint, jwkPublic, base64urlToBigint } from "../../src/crypto/jwk-utils";
import { createMockKV } from "../helpers/mock-kv";
import { p521 } from "@noble/curves/nist.js";
import type { TangStorage } from "../../src/storage/interface";

describe("POST /rec/:thp", () => {
  let kv: TangStorage;
  let env: { TANG_KEYS: TangStorage };

  beforeEach(() => {
    kv = createMockKV();
    env = { TANG_KEYS: kv };
  });

  it("performs ECMR key exchange successfully", async () => {
    const sigKey = generateSigningKey();
    const excKey = generateExchangeKey();
    await saveKey(kv, sigKey);
    await saveKey(kv, excKey);

    const clientKey = generateExchangeKey();
    const clientPub = jwkPublic(clientKey);
    const excThp = await jwkThumbprint(excKey, "S256");

    const res = await app.fetch(
      new Request(`http://localhost/rec/${excThp}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(clientPub),
      }),
      env,
    );

    expect(res.status).toBe(200);

    const result: any = await res.json();
    expect(result.kty).toBe("EC");
    expect(result.crv).toBe("P-521");
    expect(result.alg).toBe("ECMR");
    expect(result.key_ops).toEqual(["deriveKey"]);
    expect(result).not.toHaveProperty("d");
  });

  it("result matches manual ECDH computation", async () => {
    const sigKey = generateSigningKey();
    const excKey = generateExchangeKey();
    await saveKey(kv, sigKey);
    await saveKey(kv, excKey);

    const clientKey = generateExchangeKey();
    const clientPub = jwkPublic(clientKey);
    const excThp = await jwkThumbprint(excKey, "S256");

    const res = await app.fetch(
      new Request(`http://localhost/rec/${excThp}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(clientPub),
      }),
      env,
    );

    const result: any = await res.json();

    const clientX = base64urlToBigint(clientPub.x);
    const clientY = base64urlToBigint(clientPub.y);
    const clientPoint = p521.Point.fromAffine({ x: clientX, y: clientY });
    const serverD = base64urlToBigint(excKey.d);
    const expected = clientPoint.multiply(serverD).toAffine();

    expect(base64urlToBigint(result.x)).toBe(expected.x);
    expect(base64urlToBigint(result.y)).toBe(expected.y);
  });

  it("returns Content-Type application/jwk+json", async () => {
    const sigKey = generateSigningKey();
    const excKey = generateExchangeKey();
    await saveKey(kv, sigKey);
    await saveKey(kv, excKey);

    const clientKey = generateExchangeKey();
    const excThp = await jwkThumbprint(excKey, "S256");

    const res = await app.fetch(
      new Request(`http://localhost/rec/${excThp}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(jwkPublic(clientKey)),
      }),
      env,
    );

    expect(res.headers.get("content-type")).toContain("application/jwk+json");
  });

  it("returns 404 for non-existent thumbprint", async () => {
    const sigKey = generateSigningKey();
    await saveKey(kv, sigKey);

    const clientKey = generateExchangeKey();
    const res = await app.fetch(
      new Request("http://localhost/rec/nonexistent", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(jwkPublic(clientKey)),
      }),
      env,
    );

    expect(res.status).toBe(404);
  });

  it("returns 400 for invalid JSON body", async () => {
    const res = await app.fetch(
      new Request("http://localhost/rec/somethp", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: "not json",
      }),
      env,
    );

    expect(res.status).toBe(400);
  });

  it("returns 400 for non-EC key type", async () => {
    const res = await app.fetch(
      new Request("http://localhost/rec/somethp", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ kty: "RSA", n: "abc", e: "AQAB" }),
      }),
      env,
    );

    expect(res.status).toBe(400);
  });

  it("returns 413 when Content-Length exceeds limit", async () => {
    const res = await app.fetch(
      new Request("http://localhost/rec/somethp", {
        method: "POST",
        headers: { "Content-Length": "5000" },
        body: "x",
      }),
      env,
    );

    expect(res.status).toBe(413);
  });

  it("returns 500 when storage has no keys", async () => {
    const brokenKv: TangStorage = {
      get: async () => null,
      put: async () => {},
      delete: async () => {},
      list: async () => ({ keys: [] }),
    };
    const emptyEnv = { TANG_KEYS: brokenKv };

    const clientKey = generateExchangeKey();
    const res = await app.fetch(
      new Request("http://localhost/rec/somethp", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(jwkPublic(clientKey)),
      }),
      emptyEnv,
    );

    expect(res.status).toBe(500);
  });

  it("returns 403 for exchange key with non-ECMR alg", async () => {
    const sigKey = generateSigningKey();
    const excKey = generateExchangeKey();
    const badAlgKey = { ...excKey, alg: "ECDH-ES" };
    await saveKey(kv, sigKey);
    await saveKey(kv, badAlgKey);

    const clientKey = generateExchangeKey();
    const thp = await jwkThumbprint(badAlgKey, "S256");

    const res = await app.fetch(
      new Request(`http://localhost/rec/${thp}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(jwkPublic(clientKey)),
      }),
      env,
    );

    expect(res.status).toBe(403);
  });

  it("returns 400 when body stream errors", async () => {
    const errorStream = new ReadableStream({
      start(controller) {
        controller.error(new Error("stream error"));
      },
    });

    const res = await app.fetch(
      new Request("http://localhost/rec/somethp", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        // @ts-ignore — intentionally passing erroring stream
        body: errorStream,
      }),
      env,
    );

    expect(res.status).toBe(400);
  });

  it("returns 403 for signing key thumbprint (not exchange)", async () => {
    const sigKey = generateSigningKey();
    const excKey = generateExchangeKey();
    await saveKey(kv, sigKey);
    await saveKey(kv, excKey);

    const clientKey = generateExchangeKey();
    const sigThp = await jwkThumbprint(sigKey, "S256");

    const res = await app.fetch(
      new Request(`http://localhost/rec/${sigThp}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(jwkPublic(clientKey)),
      }),
      env,
    );

    expect(res.status).toBe(403);
  });
});
