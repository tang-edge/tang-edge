// SPDX-License-Identifier: GPL-3.0-only
// Copyright (c) tang-edge contributors

/**
 * Fastly Compute entry point for tang-edge.
 *
 * Deploy: fastly compute publish
 *
 * Fastly KV Store:
 *   Create a KV Store named "tang-keys" in the Fastly console and link it to your service.
 *
 * Environment variables (Fastly Config Stores or Edge Dictionary):
 *   ROTATE_TOKEN  - token for POST /rotate endpoint
 */
/// <reference types="@fastly/js-compute" />

import { KVStore, env } from "@fastly/js-compute";
import { app } from "../index";
import { FastlyKVStorage } from "../storage/adapters/fastly-kv";
import type { Env } from "../storage/types";

addEventListener("fetch", (event) => {
  const store = new KVStore("tang-keys");
  const environment: Env = {
    TANG_KEYS: new FastlyKVStorage(store),
    ROTATE_TOKEN: env("ROTATE_TOKEN"),
  };
  event.respondWith(app.fetch(event.request, environment));
});
