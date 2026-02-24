import { MemoryStorage } from "../../src/storage/adapters/memory";
import type { TangStorage } from "../../src/storage/interface";

/** Create an in-memory TangStorage for testing */
export function createMockKV(): TangStorage {
  return new MemoryStorage();
}
