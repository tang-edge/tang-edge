import type { TangStorage, TangStorageListResult } from "../interface";

export class CloudflareKVStorage implements TangStorage {
  constructor(private readonly kv: KVNamespace) {}

  async get(key: string): Promise<string | null> {
    return this.kv.get(key, "text");
  }

  async put(key: string, value: string): Promise<void> {
    await this.kv.put(key, value);
  }

  async delete(key: string): Promise<void> {
    await this.kv.delete(key);
  }

  async list(): Promise<TangStorageListResult> {
    const keys: { name: string }[] = [];
    let cursor: string | undefined;
    do {
      const result = await this.kv.list({ cursor });
      keys.push(...result.keys.map((k) => ({ name: k.name })));
      cursor = result.list_complete ? undefined : result.cursor;
    } while (cursor);
    return { keys };
  }
}
