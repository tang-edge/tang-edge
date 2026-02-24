import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { mkdtempSync, rmSync } from "node:fs";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { FileSystemStorage } from "../../src/storage/adapters/file-system";

describe("FileSystemStorage", () => {
  let dir: string;
  let storage: FileSystemStorage;

  beforeEach(() => {
    dir = mkdtempSync(join(tmpdir(), "tang-test-"));
    storage = new FileSystemStorage(dir);
  });

  afterEach(() => {
    rmSync(dir, { recursive: true, force: true });
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

  it("delete removes a key", async () => {
    await storage.put("test.jwk", "data");
    await storage.delete("test.jwk");
    const value = await storage.get("test.jwk");
    expect(value).toBeNull();
  });

  it("delete is no-op for missing key", async () => {
    await expect(storage.delete("missing.jwk")).resolves.toBeUndefined();
  });

  it("list returns only .jwk files", async () => {
    await storage.put("key1.jwk", "a");
    await storage.put(".key2.jwk", "b");
    await storage.put("readme.txt", "c");

    const result = await storage.list();
    const names = result.keys.map((k) => k.name).sort();
    expect(names).toEqual([".key2.jwk", "key1.jwk"]);
  });

  it("list returns empty for empty directory", async () => {
    const result = await storage.list();
    expect(result.keys).toEqual([]);
  });

  it("rejects path traversal in get", async () => {
    await expect(storage.get("../../../etc/passwd")).rejects.toThrow("Invalid key");
  });

  it("rejects path traversal in put", async () => {
    await expect(storage.put("../../../tmp/evil.jwk", "data")).rejects.toThrow("Invalid key");
  });

  it("rejects path traversal in delete", async () => {
    await expect(storage.delete("../../secret.jwk")).rejects.toThrow("Invalid key");
  });

  it("rejects null bytes in key", async () => {
    await expect(storage.get("key\0.jwk")).rejects.toThrow("Invalid key");
  });

  it("works with kv-store functions", async () => {
    const { saveKey, loadKeys, rotateKey } = await import(
      "../../src/storage/kv-store"
    );
    const { generateSigningKey, generateExchangeKey } = await import(
      "../../src/crypto/keygen"
    );

    const sigKey = generateSigningKey();
    const excKey = generateExchangeKey();
    await saveKey(storage, sigKey);
    await saveKey(storage, excKey);

    const info = await loadKeys(storage);
    expect(info.keys.length).toBe(2);
    expect(info.payload.length).toBe(2);
    expect(info.sign.length).toBe(1);

    // Rotate one key
    const list = await storage.list();
    const activeName = list.keys.find((k) => !k.name.startsWith("."))!.name;
    await rotateKey(storage, activeName);

    const info2 = await loadKeys(storage);
    expect(info2.keys.length).toBe(1);
    expect(info2.rotatedKeys.length).toBe(1);
  });
});
