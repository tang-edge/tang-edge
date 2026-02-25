// SPDX-License-Identifier: GPL-3.0-only
// Copyright (c) tang-edge contributors

import { runAdapterTests } from "./adapter-shared";
import { DenoKVStorage } from "../../src/storage/adapters/deno-kv";

function createMockDenoKv() {
  const store = new Map<string, string>();

  return {
    get: async <T>(key: unknown[]) => {
      const k = key[1] as string;
      const value = store.get(k) as T | undefined;
      return { value: value ?? null };
    },
    set: async (key: unknown[], value: string) => {
      const k = key[1] as string;
      store.set(k, value);
    },
    delete: async (key: unknown[]) => {
      const k = key[1] as string;
      store.delete(k);
    },
    list: <T>(selector: { prefix: unknown[] }) => {
      const entries: { key: unknown[]; value: T }[] = [];
      for (const [k, v] of store.entries()) {
        entries.push({ key: ["tang", k], value: v as T });
      }
      return entries[Symbol.asyncIterator]
        ? entries
        : (async function* () {
            for (const entry of entries) yield entry;
          })();
    },
  };
}

runAdapterTests("DenoKVStorage", () => {
  const kv = createMockDenoKv();
  return new DenoKVStorage(kv as any);
});
