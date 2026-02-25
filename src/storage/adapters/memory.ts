// SPDX-License-Identifier: GPL-3.0-only
// Copyright (c) tang-edge contributors

import type { TangStorage, TangStorageListResult } from "../interface";

export class MemoryStorage implements TangStorage {
  private readonly store = new Map<string, string>();

  async get(key: string): Promise<string | null> {
    return this.store.get(key) ?? null;
  }

  async put(key: string, value: string): Promise<void> {
    this.store.set(key, value);
  }

  async delete(key: string): Promise<void> {
    this.store.delete(key);
  }

  async list(): Promise<TangStorageListResult> {
    return {
      keys: Array.from(this.store.keys()).map((name) => ({ name })),
    };
  }
}
