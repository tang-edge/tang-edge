/**
 * Local dev server using Bun's native HTTP server.
 * Wraps the Hono app with an in-memory storage.
 * Usage: bun run dev-server.ts
 */
import { app } from "./src/index";
import { MemoryStorage } from "./src/storage/adapters/memory";
import type { Env } from "./src/storage/types";

const env: Env = {
  TANG_KEYS: new MemoryStorage(),
  ROTATE_TOKEN: "dev-token",
};

const port = 8787;
console.log(`Tang-Edge dev server listening on http://127.0.0.1:${port}`);

Bun.serve({
  port,
  fetch: (req) => app.fetch(req, env),
});
