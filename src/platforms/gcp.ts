/**
 * Google Cloud Functions entry point for tang-edge.
 *
 * Firestore collection: tang-keys
 * Document format: { value: "<JWK JSON string>" }
 *
 * Environment variables:
 *   GCP_PROJECT    - Google Cloud project ID
 *   ROTATE_TOKEN   - token for POST /rotate endpoint
 */
import { serve } from "@hono/node-server";
import { app } from "../index";
import { FirestoreStorage } from "../storage/adapters/firestore";
import type { Env } from "../storage/types";

const projectId = process.env.GCP_PROJECT;
if (!projectId) {
  throw new Error("Missing required env: GCP_PROJECT");
}

const env: Env = {
  TANG_KEYS: new FirestoreStorage(projectId),
  ROTATE_TOKEN: process.env.ROTATE_TOKEN,
};

const port = Number(process.env.PORT) || 8080;

serve({
  fetch: (req) => app.fetch(req, env),
  port,
});

console.log(`Tang-Edge listening on http://0.0.0.0:${port}`);
