import { describe, it, expect, beforeEach } from "vitest";
import type { TangStorage } from "../../src/storage/interface";

/**
 * Shared test suite that validates any TangStorage implementation.
 * Call this from each adapter's test file with a factory function.
 */
export function runAdapterTests(
  name: string,
  factory: () => TangStorage | Promise<TangStorage>,
) {
  describe(name, () => {
    let storage: TangStorage;

    beforeEach(async () => {
      storage = await factory();
    });

    it("put and get a value", async () => {
      await storage.put("test.jwk", '{"kty":"EC"}');
      const value = await storage.get("test.jwk");
      expect(value).toBe('{"kty":"EC"}');
    });

    it("get returns null for missing key", async () => {
      const value = await storage.get("missing.jwk");
      expect(value).toBeNull();
    });

    it("put overwrites existing value", async () => {
      await storage.put("test.jwk", "first");
      await storage.put("test.jwk", "second");
      const value = await storage.get("test.jwk");
      expect(value).toBe("second");
    });

    it("delete removes a key", async () => {
      await storage.put("test.jwk", "data");
      await storage.delete("test.jwk");
      const value = await storage.get("test.jwk");
      expect(value).toBeNull();
    });

    it("delete is no-op for missing key", async () => {
      await expect(storage.delete("missing.jwk")).resolves.toBeUndefined();
    });

    it("list returns stored keys", async () => {
      await storage.put("key1.jwk", "a");
      await storage.put(".key2.jwk", "b");

      const result = await storage.list();
      const names = result.keys.map((k) => k.name).sort();
      expect(names).toEqual([".key2.jwk", "key1.jwk"]);
    });

    it("list returns empty for empty storage", async () => {
      const result = await storage.list();
      expect(result.keys).toEqual([]);
    });

    it("handles multiple put/delete cycles", async () => {
      await storage.put("a.jwk", "1");
      await storage.put("b.jwk", "2");
      await storage.delete("a.jwk");
      await storage.put("c.jwk", "3");

      const result = await storage.list();
      const names = result.keys.map((k) => k.name).sort();
      expect(names).toContain("b.jwk");
      expect(names).toContain("c.jwk");
      expect(names).not.toContain("a.jwk");
    });
  });
}
