import { runAdapterTests } from "./adapter-shared";
import { CloudflareKVStorage } from "../../src/storage/adapters/cloudflare-kv";

function createMockKVNamespace() {
  const store = new Map<string, string>();

  return {
    get: async (key: string) => store.get(key) ?? null,
    put: async (key: string, value: string) => {
      store.set(key, value);
    },
    delete: async (key: string) => {
      store.delete(key);
    },
    list: async () => ({
      keys: Array.from(store.keys()).map((name) => ({ name })),
      list_complete: true,
      cacheStatus: null,
    }),
    getWithMetadata: async () => ({ value: null, metadata: null }),
  };
}

runAdapterTests("CloudflareKVStorage", () => {
  const ns = createMockKVNamespace();
  return new CloudflareKVStorage(ns as any);
});
