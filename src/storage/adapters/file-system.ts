// SPDX-License-Identifier: GPL-3.0-only
// Copyright (c) tang-edge contributors

import { readdir, readFile, writeFile, unlink } from "node:fs/promises";
import { resolve, sep } from "node:path";
import type { TangStorage, TangStorageListResult } from "../interface";

export class FileSystemStorage implements TangStorage {
  private readonly resolvedDir: string;

  constructor(private readonly dir: string) {
    this.resolvedDir = resolve(dir);
  }

  /** Resolve key to safe path, rejecting path traversal and null bytes */
  private safePath(key: string): string {
    if (key.includes("\0") || key.includes("..")) {
      throw new Error(`Invalid key: ${key}`);
    }
    const full = resolve(this.resolvedDir, key);
    if (!full.startsWith(this.resolvedDir + sep)) {
      throw new Error(`Path traversal detected: ${key}`);
    }
    return full;
  }

  async get(key: string): Promise<string | null> {
    const path = this.safePath(key);
    try {
      return await readFile(path, "utf-8");
    } catch {
      return null;
    }
  }

  async put(key: string, value: string): Promise<void> {
    await writeFile(this.safePath(key), value, "utf-8");
  }

  async delete(key: string): Promise<void> {
    const path = this.safePath(key);
    try {
      await unlink(path);
    } catch {
      // ignore if file doesn't exist
    }
  }

  async list(): Promise<TangStorageListResult> {
    try {
      const entries = await readdir(this.dir);
      return {
        keys: entries
          .filter((name) => name.endsWith(".jwk"))
          .map((name) => ({ name })),
      };
    } catch {
      return { keys: [] };
    }
  }
}
