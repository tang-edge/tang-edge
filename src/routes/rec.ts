import { Hono } from "hono";
import type { Env, ECPublicJWK } from "../storage/types";
import { hasPrivateKey } from "../storage/types";
import { ensureKeys, findKeyByThumbprint } from "../storage/kv-store";
import { isValidForDeriving } from "../crypto/jwk-utils";
import { ecmrExchange } from "../crypto/ecmr";

const rec = new Hono<{ Bindings: Env }>();

const MAX_BODY = 4096;

/** Validate client JWK is a valid P-521 ECMR public key */
function validateClientKey(key: ECPublicJWK): boolean {
  if (key.kty !== "EC" || key.crv !== "P-521") return false;
  if (key.alg && key.alg !== "ECMR") return false;
  if (!key.x || !key.y) return false;
  if (key.x.length > 120 || key.y.length > 120) return false;
  return true;
}

/** POST /rec/:thp — perform ECMR key exchange */
rec.post("/:thp", async (c) => {
  const cl = c.req.header("Content-Length");
  if (cl && Number.parseInt(cl, 10) > MAX_BODY) {
    return c.text("Payload Too Large", 413);
  }

  let body: string;
  try {
    body = await c.req.text();
  } catch {
    return c.text("Bad Request", 400);
  }
  if (body.length > MAX_BODY) {
    return c.text("Payload Too Large", 413);
  }

  let clientKey: ECPublicJWK;
  try {
    clientKey = JSON.parse(body);
  } catch {
    return c.text("Bad Request", 400);
  }
  if (!validateClientKey(clientKey)) {
    return c.text("Bad Request", 400);
  }

  const info = await ensureKeys(c.env.TANG_KEYS);
  if (info.keys.length === 0) {
    return c.text("Internal Server Error", 500);
  }

  const thp = c.req.param("thp");
  const serverKey = await findKeyByThumbprint(info, thp);
  if (!serverKey) {
    return c.text("Not Found", 404);
  }

  if (!isValidForDeriving(serverKey) || !hasPrivateKey(serverKey)) {
    return c.text("Forbidden", 403);
  }
  if (serverKey.alg && serverKey.alg !== "ECMR") {
    return c.text("Forbidden", 403);
  }

  let result: ECPublicJWK;
  try {
    result = ecmrExchange(serverKey, clientKey);
  } catch {
    return c.text("Bad Request", 400);
  }

  return c.json(result, 200, {
    "Content-Type": "application/jwk+json",
  });
});

export default rec;
