// SPDX-License-Identifier: GPL-3.0-only
// Copyright (c) tang-edge contributors

import { describe, it, expect, beforeEach } from "vitest";
import { app } from "../../src/index";
import { saveKey, loadKeys } from "../../src/storage/kv-store";
import { generateSigningKey, generateExchangeKey } from "../../src/crypto/keygen";
import { createMockKV } from "../helpers/mock-kv";
import type { TangStorage } from "../../src/storage/interface";

describe("POST /rotate", () => {
  let kv: TangStorage;

  beforeEach(() => {
    kv = createMockKV();
  });

  it("returns 500 when ROTATE_TOKEN is not set", async () => {
    const res = await app.fetch(
      new Request("http://localhost/rotate", { method: "POST" }),
      { TANG_KEYS: kv },
    );
    expect(res.status).toBe(500);
  });

  it("returns 401 without authorization header", async () => {
    const res = await app.fetch(
      new Request("http://localhost/rotate", { method: "POST" }),
      { TANG_KEYS: kv, ROTATE_TOKEN: "test-secret" },
    );
    expect(res.status).toBe(401);
  });

  it("returns 401 with wrong token", async () => {
    const res = await app.fetch(
      new Request("http://localhost/rotate", {
        method: "POST",
        headers: { Authorization: "Bearer wrong-token" },
      }),
      { TANG_KEYS: kv, ROTATE_TOKEN: "test-secret" },
    );
    expect(res.status).toBe(401);
  });

  it("rotates keys with correct token", async () => {
    const sigKey = generateSigningKey();
    const excKey = generateExchangeKey();
    await saveKey(kv, sigKey);
    await saveKey(kv, excKey);

    const res = await app.fetch(
      new Request("http://localhost/rotate", {
        method: "POST",
        headers: { Authorization: "Bearer test-secret" },
      }),
      { TANG_KEYS: kv, ROTATE_TOKEN: "test-secret" },
    );

    expect(res.status).toBe(200);

    const body: any = await res.json();
    expect(body.message).toBe("Keys rotated successfully");
    expect(body.activeKeys).toBe(2);
    expect(body.rotatedKeys).toBe(2);

    const info = await loadKeys(kv);
    expect(info.keys.length).toBe(2);
    expect(info.rotatedKeys.length).toBe(2);
  });
});
