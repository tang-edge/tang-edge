// SPDX-License-Identifier: GPL-3.0-only
// Copyright (c) tang-edge contributors

import { mock, beforeEach } from "bun:test";
import { runAdapterTests } from "./adapter-shared";

const store = new Map<string, string>();

mock.module("npm:@supabase/supabase-js@2", () => {
  function createClient(_url: string, _key: string) {
    return {
      from: (_table: string) => ({
        select: (cols: string) => ({
          eq: (col: string, key: string) => ({
            maybeSingle: async () => {
              if (cols === "value") {
                const value = store.get(key) ?? null;
                return { data: value !== null ? { value } : null, error: null };
              }
              return { data: null, error: null };
            },
          }),
          then: async (resolve: Function) => {
            const data = Array.from(store.keys()).map((k) => ({ key: k }));
            return resolve({ data, error: null });
          },
        }),
        upsert: async (row: { key: string; value: string }) => {
          store.set(row.key, row.value);
          return { error: null };
        },
        delete: () => ({
          eq: async (_col: string, key: string) => {
            store.delete(key);
            return { error: null };
          },
        }),
      }),
    };
  }

  return { createClient };
});

const { SupabaseStorage } = await import("../../src/storage/adapters/supabase");

beforeEach(() => store.clear());

runAdapterTests(
  "SupabaseStorage",
  () => new SupabaseStorage("https://test.supabase.co", "test-service-key"),
);
