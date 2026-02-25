// SPDX-License-Identifier: GPL-3.0-only
// Copyright (c) tang-edge contributors

import { mock, beforeEach } from "bun:test";
import { runAdapterTests } from "./adapter-shared";

const store = new Map<string, string>();

mock.module("@netlify/blobs", () => ({
  getStore: () => ({
    get: async (key: string) => store.get(key) ?? null,
    set: async (key: string, value: string) => {
      store.set(key, value);
    },
    delete: async (key: string) => {
      store.delete(key);
    },
    list: async () => ({
      blobs: Array.from(store.keys()).map((k) => ({ key: k })),
    }),
  }),
}));

const { NetlifyBlobsStorage } = await import("../../src/storage/adapters/netlify-blobs");

beforeEach(() => store.clear());

runAdapterTests(
  "NetlifyBlobsStorage",
  () => new NetlifyBlobsStorage("site-id", "token"),
);
