import { Hono } from "hono";
import type { Env } from "../storage/types";
import { rotateAllKeys } from "../storage/kv-store";

const rotate = new Hono<{ Bindings: Env }>();

/** Constant-time string comparison to prevent timing attacks (length-safe) */
function timingSafeEqual(a: string, b: string): boolean {
  const encoder = new TextEncoder();
  const bufA = encoder.encode(a);
  const bufB = encoder.encode(b);
  const maxLen = Math.max(bufA.length, bufB.length);
  let result = bufA.length ^ bufB.length;
  for (let i = 0; i < maxLen; i++) {
    result |= (bufA[i] ?? 0) ^ (bufB[i] ?? 0);
  }
  return result === 0;
}

/** POST /rotate — rotate all active keys (protected by token) */
rotate.post("/", async (c) => {
  const token = c.env.ROTATE_TOKEN;
  if (!token) {
    return c.text("Rotation endpoint not configured", 500);
  }

  const auth = c.req.header("Authorization");
  if (!auth || !timingSafeEqual(auth, `Bearer ${token}`)) {
    return c.text("Unauthorized", 401);
  }

  const info = await rotateAllKeys(c.env.TANG_KEYS);
  return c.json({
    message: "Keys rotated successfully",
    activeKeys: info.keys.length,
    rotatedKeys: info.rotatedKeys.length,
  });
});

export default rotate;
