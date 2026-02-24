import type { TangStorage, TangStorageListResult } from "../interface";
import { createClient, type SupabaseClient } from "npm:@supabase/supabase-js@2";

const TABLE = "tang_keys";

/** Wrap Supabase errors to prevent leaking connection details */
function storageError(op: string, error: unknown): Error {
  const code = error && typeof error === "object" && "code" in error ? (error as { code: string }).code : "UNKNOWN";
  return new Error(`SupabaseStorage.${op} failed (${code})`);
}

export class SupabaseStorage implements TangStorage {
  private readonly client: SupabaseClient;

  constructor(url: string, serviceRoleKey: string) {
    this.client = createClient(url, serviceRoleKey);
  }

  async get(key: string): Promise<string | null> {
    const { data, error } = await this.client
      .from(TABLE)
      .select("value")
      .eq("key", key)
      .maybeSingle();
    if (error) throw storageError("get", error);
    return data?.value ?? null;
  }

  async put(key: string, value: string): Promise<void> {
    const { error } = await this.client
      .from(TABLE)
      .upsert({ key, value }, { onConflict: "key" });
    if (error) throw storageError("put", error);
  }

  async delete(key: string): Promise<void> {
    const { error } = await this.client
      .from(TABLE)
      .delete()
      .eq("key", key);
    if (error) throw storageError("delete", error);
  }

  async list(): Promise<TangStorageListResult> {
    const { data, error } = await this.client
      .from(TABLE)
      .select("key");
    if (error) throw storageError("list", error);
    return {
      keys: (data ?? []).map((row) => ({ name: row.key })),
    };
  }
}
