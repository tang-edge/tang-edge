// SPDX-License-Identifier: GPL-3.0-only
// Copyright (c) tang-edge contributors

import { describe, it, expect, beforeEach } from "vitest";
import { app } from "../../src/index";
import { MemoryStorage } from "../../src/storage/adapters/memory";
import { ensureKeys } from "../../src/storage/kv-store";
import { jwkThumbprint, isValidForDeriving } from "../../src/crypto/jwk-utils";
import type { Env } from "../../src/storage/types";

function createEnv(): Env {
  return {
    TANG_KEYS: new MemoryStorage(),
    ROTATE_TOKEN: "test-token",
  };
}

describe("Security: Input Validation", () => {
  let env: Env;

  beforeEach(async () => {
    env = createEnv();
    await ensureKeys(env.TANG_KEYS);
  });

  async function getExchangeThumbprint(): Promise<string> {
    const info = await ensureKeys(env.TANG_KEYS);
    const excKey = info.keys.find((k) => isValidForDeriving(k))!;
    return jwkThumbprint(excKey, "S256");
  }

  describe("POST /rec/:thp", () => {
    it("rejects empty body", async () => {
      const thp = await getExchangeThumbprint();
      const res = await app.fetch(
        new Request(`http://localhost/rec/${thp}`, {
          method: "POST",
          body: "",
          headers: { "Content-Type": "application/json" },
        }),
        env,
      );
      expect(res.status).toBe(400);
    });

    it("rejects malformed JSON", async () => {
      const thp = await getExchangeThumbprint();
      const res = await app.fetch(
        new Request(`http://localhost/rec/${thp}`, {
          method: "POST",
          body: "{not json",
          headers: { "Content-Type": "application/json" },
        }),
        env,
      );
      expect(res.status).toBe(400);
    });

    it("rejects key without kty field", async () => {
      const thp = await getExchangeThumbprint();
      const res = await app.fetch(
        new Request(`http://localhost/rec/${thp}`, {
          method: "POST",
          body: JSON.stringify({ x: "abc", y: "def" }),
          headers: { "Content-Type": "application/json" },
        }),
        env,
      );
      expect(res.status).toBe(400);
    });

    it("rejects non-EC key type", async () => {
      const thp = await getExchangeThumbprint();
      const res = await app.fetch(
        new Request(`http://localhost/rec/${thp}`, {
          method: "POST",
          body: JSON.stringify({ kty: "RSA", x: "abc", y: "def" }),
          headers: { "Content-Type": "application/json" },
        }),
        env,
      );
      expect(res.status).toBe(400);
    });

    it("rejects wrong curve", async () => {
      const thp = await getExchangeThumbprint();
      const res = await app.fetch(
        new Request(`http://localhost/rec/${thp}`, {
          method: "POST",
          body: JSON.stringify({ kty: "EC", crv: "P-256", x: "abc", y: "def" }),
          headers: { "Content-Type": "application/json" },
        }),
        env,
      );
      expect(res.status).toBe(400);
    });

    it("rejects missing curve", async () => {
      const thp = await getExchangeThumbprint();
      const res = await app.fetch(
        new Request(`http://localhost/rec/${thp}`, {
          method: "POST",
          body: JSON.stringify({ kty: "EC", x: "abc", y: "def" }),
          headers: { "Content-Type": "application/json" },
        }),
        env,
      );
      expect(res.status).toBe(400);
    });

    it("rejects key with wrong algorithm", async () => {
      const thp = await getExchangeThumbprint();
      const res = await app.fetch(
        new Request(`http://localhost/rec/${thp}`, {
          method: "POST",
          body: JSON.stringify({ kty: "EC", crv: "P-521", alg: "ES256", x: "abc", y: "def" }),
          headers: { "Content-Type": "application/json" },
        }),
        env,
      );
      expect(res.status).toBe(400);
    });

    it("rejects key without x coordinate", async () => {
      const thp = await getExchangeThumbprint();
      const res = await app.fetch(
        new Request(`http://localhost/rec/${thp}`, {
          method: "POST",
          body: JSON.stringify({ kty: "EC", crv: "P-521", y: "def" }),
          headers: { "Content-Type": "application/json" },
        }),
        env,
      );
      expect(res.status).toBe(400);
    });

    it("rejects key without y coordinate", async () => {
      const thp = await getExchangeThumbprint();
      const res = await app.fetch(
        new Request(`http://localhost/rec/${thp}`, {
          method: "POST",
          body: JSON.stringify({ kty: "EC", crv: "P-521", x: "abc" }),
          headers: { "Content-Type": "application/json" },
        }),
        env,
      );
      expect(res.status).toBe(400);
    });

    it("rejects oversized coordinates", async () => {
      const thp = await getExchangeThumbprint();
      const res = await app.fetch(
        new Request(`http://localhost/rec/${thp}`, {
          method: "POST",
          body: JSON.stringify({ kty: "EC", crv: "P-521", x: "A".repeat(200), y: "B".repeat(200) }),
          headers: { "Content-Type": "application/json" },
        }),
        env,
      );
      expect(res.status).toBe(400);
    });

    it("rejects invalid base64url coordinates (invalid curve point)", async () => {
      const thp = await getExchangeThumbprint();
      const res = await app.fetch(
        new Request(`http://localhost/rec/${thp}`, {
          method: "POST",
          body: JSON.stringify({
            kty: "EC",
            crv: "P-521",
            x: "AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA",
            y: "AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA",
          }),
          headers: { "Content-Type": "application/json" },
        }),
        env,
      );
      expect(res.status).toBe(400);
    });

    it("returns 404 for non-existent thumbprint", async () => {
      const res = await app.fetch(
        new Request("http://localhost/rec/nonexistent-thp", {
          method: "POST",
          body: JSON.stringify({ kty: "EC", crv: "P-521", x: "abc", y: "def" }),
          headers: { "Content-Type": "application/json" },
        }),
        env,
      );
      expect(res.status).toBe(404);
    });

    it("rejects huge payload (>64KB)", async () => {
      const thp = await getExchangeThumbprint();
      const hugeBody = JSON.stringify({
        kty: "EC",
        crv: "P-521",
        x: "A".repeat(100000),
        y: "B".repeat(100000),
      });
      const res = await app.fetch(
        new Request(`http://localhost/rec/${thp}`, {
          method: "POST",
          body: hugeBody,
          headers: { "Content-Type": "application/json" },
        }),
        env,
      );
      // Should get 413 from body size limit (4 KB)
      expect(res.status).toBe(413);
    });
  });

  describe("POST /rotate", () => {
    it("rejects missing Authorization header", async () => {
      const res = await app.fetch(
        new Request("http://localhost/rotate", { method: "POST" }),
        env,
      );
      expect(res.status).toBe(401);
    });

    it("rejects wrong token", async () => {
      const res = await app.fetch(
        new Request("http://localhost/rotate", {
          method: "POST",
          headers: { Authorization: "Bearer wrong-token" },
        }),
        env,
      );
      expect(res.status).toBe(401);
    });

    it("rejects Basic auth scheme", async () => {
      const res = await app.fetch(
        new Request("http://localhost/rotate", {
          method: "POST",
          headers: { Authorization: "Basic dGVzdDp0ZXN0" },
        }),
        env,
      );
      expect(res.status).toBe(401);
    });

    it("returns 500 when ROTATE_TOKEN not set", async () => {
      const envNoToken = { ...env, ROTATE_TOKEN: undefined };
      const res = await app.fetch(
        new Request("http://localhost/rotate", {
          method: "POST",
          headers: { Authorization: "Bearer anything" },
        }),
        envNoToken,
      );
      expect(res.status).toBe(500);
    });
  });

  describe("GET /adv", () => {
    it("returns JWS with correct content type", async () => {
      const res = await app.fetch(
        new Request("http://localhost/adv"),
        env,
      );
      expect(res.status).toBe(200);
      expect(res.headers.get("Content-Type")).toContain("application/jose+json");
    });

    it("returns 404 for nonexistent thumbprint", async () => {
      const res = await app.fetch(
        new Request("http://localhost/adv/nonexistent"),
        env,
      );
      expect(res.status).toBe(404);
    });
  });
});
