// SPDX-License-Identifier: GPL-3.0-only
// Copyright (c) tang-edge contributors

/**
 * Vercel Serverless Functions entry point for tang-edge.
 *
 * Add to vercel.json:
 *   { "rewrites": [{ "source": "/(.*)", "destination": "/api" }] }
 *
 * Environment variables (set in Vercel Dashboard):
 *   KV_REST_API_URL    - Vercel KV connection URL
 *   KV_REST_API_TOKEN  - Vercel KV token
 *   ROTATE_TOKEN       - token for POST /rotate endpoint
 */
import { handle } from "hono/vercel";
import { app } from "../index";
import { VercelKVStorage } from "../storage/adapters/vercel-kv";
import type { Env } from "../storage/types";

const env: Env = {
  TANG_KEYS: new VercelKVStorage(),
  ROTATE_TOKEN: process.env.ROTATE_TOKEN,
};

export default handle(app, (req) => app.fetch(req, env));
