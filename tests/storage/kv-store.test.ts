// SPDX-License-Identifier: GPL-3.0-only
// Copyright (c) tang-edge contributors

import { describe, it, expect, beforeEach, spyOn } from "bun:test";
import { MemoryStorage } from "../../src/storage/adapters/memory";
import {
  loadKeys,
  saveKey,
  rotateKey,
  ensureKeys,
  rotateAllKeys,
  findKeyByThumbprint,
} from "../../src/storage/kv-store";
import { generateSigningKey, generateExchangeKey } from "../../src/crypto/keygen";
import { jwkThumbprint } from "../../src/crypto/jwk-utils";

describe("kv-store", () => {
  let kv: MemoryStorage;

  beforeEach(() => {
    kv = new MemoryStorage();
  });

  describe("loadKeys", () => {
    it("returns empty arrays for empty storage", async () => {
      const info = await loadKeys(kv);
      expect(info.keys).toEqual([]);
      expect(info.rotatedKeys).toEqual([]);
      expect(info.payload).toEqual([]);
      expect(info.sign).toEqual([]);
    });

    it("separates active and rotated keys", async () => {
      const sigKey = generateSigningKey();
      const excKey = generateExchangeKey();
      await saveKey(kv, sigKey);
      await saveKey(kv, excKey);

      // Rotate one key
      const list = await kv.list();
      const firstName = list.keys[0].name;
      await rotateKey(kv, firstName);

      const info = await loadKeys(kv);
      expect(info.keys.length).toBe(1);
      expect(info.rotatedKeys.length).toBe(1);
    });

    it("populates payload with public keys for signing keys", async () => {
      const sigKey = generateSigningKey();
      await saveKey(kv, sigKey);

      const info = await loadKeys(kv);
      expect(info.payload.length).toBe(1);
      expect(info.sign.length).toBe(1);
      // Public key should not contain private material
      expect(info.payload[0]).not.toHaveProperty("d");
    });

    it("populates payload with public keys for exchange keys", async () => {
      const excKey = generateExchangeKey();
      await saveKey(kv, excKey);

      const info = await loadKeys(kv);
      expect(info.payload.length).toBe(1);
      expect(info.sign.length).toBe(0);
    });

    it("skips non-.jwk entries", async () => {
      await kv.put("readme.txt", "hello");
      await kv.put("test.jwk", JSON.stringify(generateSigningKey()));

      const info = await loadKeys(kv);
      expect(info.keys.length).toBe(1);
    });

    it("skips entries with invalid JSON", async () => {
      await kv.put("bad.jwk", "not-json{{{");
      await kv.put("good.jwk", JSON.stringify(generateSigningKey()));

      const info = await loadKeys(kv);
      expect(info.keys.length).toBe(1);
    });

    it("skips entries that return null from storage", async () => {
      // Simulate a race condition: key listed but deleted before get
      const original = kv.get.bind(kv);
      let callCount = 0;
      spyOn(kv, "get").mockImplementation(async (key) => {
        callCount++;
        if (callCount === 1) return null; // first key "disappears"
        return original(key);
      });

      await kv.put("a.jwk", JSON.stringify(generateSigningKey()));
      await kv.put("b.jwk", JSON.stringify(generateExchangeKey()));

      const info = await loadKeys(kv);
      // One of the two should be skipped
      expect(info.keys.length).toBe(1);
    });
  });

  describe("saveKey", () => {
    it("saves key by thumbprint and returns thumbprint", async () => {
      const key = generateSigningKey();
      const thp = await saveKey(kv, key);
      expect(thp).toBeTruthy();

      const stored = await kv.get(`${thp}.jwk`);
      expect(stored).toBeTruthy();
      expect(JSON.parse(stored!)).toEqual(key);
    });
  });

  describe("rotateKey", () => {
    it("moves key to dotted name and deletes original", async () => {
      const key = generateSigningKey();
      const thp = await saveKey(kv, key);
      const name = `${thp}.jwk`;

      await rotateKey(kv, name);

      expect(await kv.get(name)).toBeNull();
      expect(await kv.get(`.${name}`)).toBeTruthy();
    });

    it("does nothing for already-rotated key", async () => {
      await kv.put(".already.jwk", "data");
      await rotateKey(kv, ".already.jwk");
      // Should still exist in original location
      expect(await kv.get(".already.jwk")).toBe("data");
    });

    it("does nothing for missing key", async () => {
      await expect(rotateKey(kv, "nonexistent.jwk")).resolves.toBeUndefined();
    });
  });

  describe("ensureKeys", () => {
    it("creates key pair when storage is empty", async () => {
      const info = await ensureKeys(kv);
      expect(info.keys.length).toBe(2);
      expect(info.sign.length).toBe(1);
      expect(info.payload.length).toBe(2);
    });

    it("is idempotent — does not create if keys exist", async () => {
      await ensureKeys(kv);
      const list1 = await kv.list();

      await ensureKeys(kv);
      const list2 = await kv.list();

      expect(list1.keys.length).toBe(list2.keys.length);
    });
  });

  describe("rotateAllKeys", () => {
    it("rotates all active keys and creates new pair", async () => {
      await ensureKeys(kv);
      const infoBefore = await loadKeys(kv);
      expect(infoBefore.keys.length).toBe(2);
      expect(infoBefore.rotatedKeys.length).toBe(0);

      const infoAfter = await rotateAllKeys(kv);
      expect(infoAfter.keys.length).toBe(2); // new pair
      expect(infoAfter.rotatedKeys.length).toBe(2); // old pair rotated
    });

    it("works on empty storage", async () => {
      const info = await rotateAllKeys(kv);
      expect(info.keys.length).toBe(2);
      expect(info.rotatedKeys.length).toBe(0);
    });
  });

  describe("findKeyByThumbprint", () => {
    it("finds active key by S256 thumbprint", async () => {
      const key = generateSigningKey();
      await saveKey(kv, key);
      const info = await loadKeys(kv);

      const thp = await jwkThumbprint(key, "S256");
      const found = await findKeyByThumbprint(info, thp);
      expect(found).toBeTruthy();
      expect(found!.x).toBe(key.x);
    });

    it("finds key by S384 thumbprint", async () => {
      const key = generateExchangeKey();
      await saveKey(kv, key);
      const info = await loadKeys(kv);

      const thp = await jwkThumbprint(key, "S384");
      const found = await findKeyByThumbprint(info, thp);
      expect(found).toBeTruthy();
      expect(found!.x).toBe(key.x);
    });

    it("finds key by S512 thumbprint", async () => {
      const key = generateExchangeKey();
      await saveKey(kv, key);
      const info = await loadKeys(kv);

      const thp = await jwkThumbprint(key, "S512");
      const found = await findKeyByThumbprint(info, thp);
      expect(found).toBeTruthy();
    });

    it("finds key by S1 thumbprint", async () => {
      const key = generateExchangeKey();
      await saveKey(kv, key);
      const info = await loadKeys(kv);

      const thp = await jwkThumbprint(key, "S1");
      const found = await findKeyByThumbprint(info, thp);
      expect(found).toBeTruthy();
    });

    it("finds rotated key", async () => {
      const key = generateExchangeKey();
      const thpStr = await saveKey(kv, key);
      await rotateKey(kv, `${thpStr}.jwk`);
      const info = await loadKeys(kv);

      const thp = await jwkThumbprint(key, "S256");
      const found = await findKeyByThumbprint(info, thp);
      expect(found).toBeTruthy();
      expect(found!.x).toBe(key.x);
    });

    it("returns null for unknown thumbprint", async () => {
      await ensureKeys(kv);
      const info = await loadKeys(kv);

      const found = await findKeyByThumbprint(info, "nonexistent-thp");
      expect(found).toBeNull();
    });
  });
});
