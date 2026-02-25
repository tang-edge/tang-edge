// SPDX-License-Identifier: GPL-3.0-only
// Copyright (c) tang-edge contributors

import { MemoryStorage } from "../../src/storage/adapters/memory";
import type { TangStorage } from "../../src/storage/interface";

/** Create an in-memory TangStorage for testing */
export function createMockKV(): TangStorage {
  return new MemoryStorage();
}
