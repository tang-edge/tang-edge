// SPDX-License-Identifier: GPL-3.0-only
// Copyright (c) tang-edge contributors

import { mock, beforeEach } from "bun:test";
import { runAdapterTests } from "./adapter-shared";

const store = new Map<string, string>();

mock.module("@google-cloud/firestore", () => {
  function createDoc(key: string) {
    return {
      id: key,
      get: async () => ({
        exists: store.has(key),
        data: () => (store.has(key) ? { value: store.get(key) } : undefined),
      }),
      set: async (data: any) => {
        store.set(key, data.value);
      },
      delete: async () => {
        store.delete(key);
      },
    };
  }

  const collection = (_name: string) => ({
    doc: (key: string) => createDoc(key),
    listDocuments: async () =>
      Array.from(store.keys()).map((k) => ({ id: k })),
  });

  class Firestore {
    collection = collection;
  }

  return { Firestore };
});

const { FirestoreStorage } = await import("../../src/storage/adapters/firestore");

beforeEach(() => store.clear());

runAdapterTests("FirestoreStorage", () => new FirestoreStorage("test-project"));
