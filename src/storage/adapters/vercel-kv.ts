import type { TangStorage, TangStorageListResult } from "../interface";
import { kv } from "@vercel/kv";

const PREFIX = "tang:";

export class VercelKVStorage implements TangStorage {
  async get(key: string): Promise<string | null> {
    return kv.get<string>(PREFIX + key);
  }

  async put(key: string, value: string): Promise<void> {
    await kv.set(PREFIX + key, value);
  }

  async delete(key: string): Promise<void> {
    await kv.del(PREFIX + key);
  }

  async list(): Promise<TangStorageListResult> {
    const rawKeys: string[] = [];
    let cursor = 0;
    do {
      const [nextCursor, keys] = await kv.scan(cursor, { match: PREFIX + "*", count: 100 });
      rawKeys.push(...keys);
      cursor = Number(nextCursor);
    } while (cursor !== 0);
    return {
      keys: rawKeys.map((k) => ({ name: k.slice(PREFIX.length) })),
    };
  }
}
