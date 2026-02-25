// SPDX-License-Identifier: GPL-3.0-only
// Copyright (c) tang-edge contributors

import { Hono } from "hono";
import type { Env } from "./storage/types";
import { CloudflareKVStorage } from "./storage/adapters/cloudflare-kv";
import adv from "./routes/adv";
import rec from "./routes/rec";
import rotate from "./routes/rotate";
import { rotateAllKeys } from "./storage/kv-store";

interface CloudflareEnv {
  TANG_KEYS: KVNamespace;
  ROTATE_TOKEN?: string;
}

const app = new Hono<{ Bindings: Env }>();

// Security headers
app.use("*", async (c, next) => {
  await next();
  c.header("X-Content-Type-Options", "nosniff");
  c.header("Cache-Control", "no-store");
});

// Strip trailing slashes without redirect (clevis uses /adv/ with trailing slash)
app.use("*", async (c, next) => {
  const url = new URL(c.req.url);
  if (url.pathname.length > 1 && url.pathname.endsWith("/")) {
    url.pathname = url.pathname.replace(/\/+$/, "");
    const newReq = new Request(url.toString(), c.req.raw);
    return app.fetch(newReq, c.env);
  }
  return next();
});

// Tang protocol endpoints
app.route("/adv", adv);
app.route("/rec", rec);

// Management endpoints
app.route("/rotate", rotate);

// Health check
app.get("/", (c) => {
  return c.json({ service: "tang-edge", status: "ok" });
});

function wrapEnv(cfEnv: CloudflareEnv): Env {
  return {
    TANG_KEYS: new CloudflareKVStorage(cfEnv.TANG_KEYS),
    ROTATE_TOKEN: cfEnv.ROTATE_TOKEN,
  };
}

export { app };

export default {
  fetch: (req: Request, env: CloudflareEnv, ctx: ExecutionContext) =>
    app.fetch(req, wrapEnv(env), ctx),
  scheduled: async (
    _event: ScheduledEvent,
    env: CloudflareEnv,
    _ctx: ExecutionContext,
  ) => {
    await rotateAllKeys(new CloudflareKVStorage(env.TANG_KEYS));
  },
};
