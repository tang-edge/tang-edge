// SPDX-License-Identifier: GPL-3.0-only
// Copyright (c) tang-edge contributors

import { describe, it, expect, beforeEach } from "vitest";
import { app } from "../src/index";
import { MemoryStorage } from "../src/storage/adapters/memory";
import type { Env } from "../src/storage/types";

function createEnv(): Env {
  return {
    TANG_KEYS: new MemoryStorage(),
    ROTATE_TOKEN: "test-token",
  };
}

function req(path: string, method = "GET"): Request {
  return new Request(`http://localhost${path}`, { method });
}

describe("App", () => {
  let env: Env;

  beforeEach(() => {
    env = createEnv();
  });

  it("GET / returns health check", async () => {
    const res = await app.fetch(req("/"), env);
    expect(res.status).toBe(200);
    const body = (await res.json()) as { service: string; status: string };
    expect(body).toEqual({ service: "tang-edge", status: "ok" });
  });

  it("strips trailing slash from /adv/", async () => {
    const res = await app.fetch(req("/adv/"), env);
    expect(res.status).toBe(200);
    const contentType = res.headers.get("Content-Type");
    expect(contentType).toContain("application/jose+json");
  });

  it("strips trailing slash from /adv//", async () => {
    const res = await app.fetch(req("/adv//"), env);
    expect(res.status).toBe(200);
  });

  it("does not strip single /", async () => {
    const res = await app.fetch(req("/"), env);
    expect(res.status).toBe(200);
    const body = (await res.json()) as { service: string };
    expect(body.service).toBe("tang-edge");
  });

  it("returns 404 for unknown paths", async () => {
    const res = await app.fetch(req("/unknown"), env);
    expect(res.status).toBe(404);
  });

  it("routes /adv correctly", async () => {
    const res = await app.fetch(req("/adv"), env);
    expect(res.status).toBe(200);
  });

  it("sets security headers on responses", async () => {
    const res = await app.fetch(req("/"), env);
    expect(res.headers.get("X-Content-Type-Options")).toBe("nosniff");
    expect(res.headers.get("Cache-Control")).toBe("no-store");
  });

  it("routes POST /rotate correctly with auth", async () => {
    const res = await app.fetch(
      new Request("http://localhost/rotate", {
        method: "POST",
        headers: { Authorization: "Bearer test-token" },
      }),
      env,
    );
    expect(res.status).toBe(200);
  });
});
