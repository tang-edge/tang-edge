import type { TangStorage, TangStorageListResult } from "../interface";

export class DenoKVStorage implements TangStorage {
  private readonly kv: Deno.Kv;

  constructor(kv: Deno.Kv) {
    this.kv = kv;
  }

  static async open(path?: string): Promise<DenoKVStorage> {
    const kv = await Deno.openKv(path);
    return new DenoKVStorage(kv);
  }

  async get(key: string): Promise<string | null> {
    const entry = await this.kv.get<string>(["tang", key]);
    return entry.value;
  }

  async put(key: string, value: string): Promise<void> {
    await this.kv.set(["tang", key], value);
  }

  async delete(key: string): Promise<void> {
    await this.kv.delete(["tang", key]);
  }

  async list(): Promise<TangStorageListResult> {
    const keys: { name: string }[] = [];
    const entries = this.kv.list<string>({ prefix: ["tang"] });
    for await (const entry of entries) {
      const name = entry.key[1] as string;
      keys.push({ name });
    }
    return { keys };
  }
}
