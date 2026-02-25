// SPDX-License-Identifier: GPL-3.0-only
// Copyright (c) tang-edge contributors

import { runAdapterTests } from "./adapter-shared";
import { FastlyKVStorage } from "../../src/storage/adapters/fastly-kv";

function createMockKVStore() {
  const store = new Map<string, string>();

  return {
    get: async (key: string) => {
      const value = store.get(key);
      if (value === undefined) return null;
      return { text: async () => value };
    },
    put: async (key: string, value: string) => {
      store.set(key, value);
    },
    delete: async (key: string) => {
      store.delete(key);
    },
  };
}

runAdapterTests("FastlyKVStorage", () => {
  const mock = createMockKVStore();
  return new FastlyKVStorage(mock);
});
