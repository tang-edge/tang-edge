/**
 * Netlify Functions entry point for tang-edge.
 *
 * Environment variables (set in Netlify Dashboard):
 *   NETLIFY_SITE_ID  - Netlify site ID
 *   NETLIFY_TOKEN    - Netlify API token
 *   ROTATE_TOKEN     - token for POST /rotate endpoint
 */
import { handle } from "hono/netlify";
import { app } from "../index";
import { NetlifyBlobsStorage } from "../storage/adapters/netlify-blobs";
import type { Env } from "../storage/types";

const siteId = process.env.NETLIFY_SITE_ID;
const token = process.env.NETLIFY_TOKEN;
if (!siteId || !token) {
  throw new Error("Missing required env: NETLIFY_SITE_ID, NETLIFY_TOKEN");
}

const env: Env = {
  TANG_KEYS: new NetlifyBlobsStorage(siteId, token),
  ROTATE_TOKEN: process.env.ROTATE_TOKEN,
};

export default handle(app, (req) => app.fetch(req, env));
