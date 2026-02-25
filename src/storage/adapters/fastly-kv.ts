// SPDX-License-Identifier: GPL-3.0-only
// Copyright (c) tang-edge contributors

import type { TangStorage, TangStorageListResult } from "../interface";

const INDEX_KEY = "__index__";

export class FastlyKVStorage implements TangStorage {
  constructor(private readonly store: { get(key: string): Promise<{ text(): Promise<string> } | null>; put(key: string, value: string): Promise<void>; delete(key: string): Promise<void> }) {}

  async get(key: string): Promise<string | null> {
    const entry = await this.store.get(key);
    return entry ? entry.text() : null;
  }

  async put(key: string, value: string): Promise<void> {
    const index = await this.readIndex();
    if (!index.includes(key)) {
      index.push(key);
      await this.store.put(INDEX_KEY, JSON.stringify(index));
    }
    await this.store.put(key, value);
  }

  async delete(key: string): Promise<void> {
    const index = await this.readIndex();
    const updated = index.filter((k) => k !== key);
    await this.store.put(INDEX_KEY, JSON.stringify(updated));
    await this.store.delete(key);
  }

  async list(): Promise<TangStorageListResult> {
    const index = await this.readIndex();
    return { keys: index.map((name) => ({ name })) };
  }

  private async readIndex(): Promise<string[]> {
    const entry = await this.store.get(INDEX_KEY);
    if (!entry) return [];
    try {
      return JSON.parse(await entry.text());
    } catch {
      return [];
    }
  }
}
