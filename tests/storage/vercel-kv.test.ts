import { mock, beforeEach } from "bun:test";
import { runAdapterTests } from "./adapter-shared";

const store = new Map<string, string>();

mock.module("@vercel/kv", () => ({
  kv: {
    get: async (key: string) => store.get(key) ?? null,
    set: async (key: string, value: string) => {
      store.set(key, value);
    },
    del: async (key: string) => {
      store.delete(key);
    },
    scan: async (cursor: number, opts: { match: string; count: number }) => {
      const prefix = opts.match.replace("*", "");
      const keys = Array.from(store.keys()).filter((k) => k.startsWith(prefix));
      return [0, keys];
    },
  },
}));

const { VercelKVStorage } = await import("../../src/storage/adapters/vercel-kv");

beforeEach(() => store.clear());

runAdapterTests("VercelKVStorage", () => new VercelKVStorage());
