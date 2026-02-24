/**
 * Bun standalone server for tang-edge.
 * Uses FileSystemStorage for key persistence (compatible with original tang).
 *
 * Usage: bun run src/platforms/bun.ts
 *
 * Environment variables:
 *   TANG_DB         - directory for JWK files (default: /var/db/tang)
 *   ROTATE_TOKEN    - token for POST /rotate endpoint
 *   HOST            - bind address (default: 127.0.0.1)
 *   PORT            - listen port (default: 8080)
 */
import { app } from "../index";
import { FileSystemStorage } from "../storage/adapters/file-system";
import type { Env } from "../storage/types";
import { mkdirSync } from "node:fs";

const tangDb = process.env.TANG_DB ?? "/var/db/tang";
const host = process.env.HOST ?? "127.0.0.1";
const port = Number(process.env.PORT) ?? 8080;

mkdirSync(tangDb, { recursive: true });

const env: Env = {
  TANG_KEYS: new FileSystemStorage(tangDb),
  ROTATE_TOKEN: process.env.ROTATE_TOKEN,
};

console.log(`Tang-Edge listening on http://${host}:${port}`);
console.log(`Key storage: ${tangDb}`);

Bun.serve({
  hostname: host,
  port,
  fetch: (req) => app.fetch(req, env),
});
