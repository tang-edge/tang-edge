import type { TangStorage, TangStorageListResult } from "../interface";
import { getStore } from "@netlify/blobs";

export class NetlifyBlobsStorage implements TangStorage {
  private readonly store: ReturnType<typeof getStore>;

  constructor(siteID: string, token: string) {
    this.store = getStore({ name: "tang-keys", siteID, token });
  }

  async get(key: string): Promise<string | null> {
    const value = await this.store.get(key);
    return value;
  }

  async put(key: string, value: string): Promise<void> {
    await this.store.set(key, value);
  }

  async delete(key: string): Promise<void> {
    await this.store.delete(key);
  }

  async list(): Promise<TangStorageListResult> {
    const { blobs } = await this.store.list();
    return {
      keys: blobs.map((b) => ({ name: b.key })),
    };
  }
}
