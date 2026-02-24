export interface TangStorageListResult {
  keys: { name: string }[];
}

export interface TangStorage {
  get(key: string): Promise<string | null>;
  put(key: string, value: string): Promise<void>;
  delete(key: string): Promise<void>;
  list(): Promise<TangStorageListResult>;
}
