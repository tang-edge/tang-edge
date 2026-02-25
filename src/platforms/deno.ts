// SPDX-License-Identifier: GPL-3.0-only
// Copyright (c) tang-edge contributors

/**
 * Deno Deploy entry point for tang-edge.
 *
 * Deploy: deployctl deploy --project=tang-edge src/platforms/deno.ts
 *
 * Environment variables:
 *   ROTATE_TOKEN  - token for POST /rotate endpoint
 */
import { app } from "../index";
import { DenoKVStorage } from "../storage/adapters/deno-kv";
import type { Env } from "../storage/types";

const storage = await DenoKVStorage.open();

const env: Env = {
  TANG_KEYS: storage,
  ROTATE_TOKEN: Deno.env.get("ROTATE_TOKEN"),
};

Deno.serve((req) => app.fetch(req, env));
