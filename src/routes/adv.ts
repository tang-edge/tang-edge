import { Hono } from "hono";
import type { Env } from "../storage/types";
import { ensureKeys, findKeyByThumbprint } from "../storage/kv-store";
import { isValidForSigning } from "../crypto/jwk-utils";
import { signAdvertisement } from "../crypto/jws";

const adv = new Hono<{ Bindings: Env }>();

/** GET /adv — advertise all public keys */
adv.get("/", async (c) => {
  const info = await ensureKeys(c.env.TANG_KEYS);
  if (info.sign.length === 0 || info.payload.length === 0) {
    return c.text("Internal Server Error", 500);
  }

  const jws = await signAdvertisement(info.payload, info.sign);
  return c.json(jws, 200, {
    "Content-Type": "application/jose+json",
  });
});

/** GET /adv/:thp — advertise keys, additionally signed by the requested key */
adv.get("/:thp", async (c) => {
  const thp = c.req.param("thp");
  const info = await ensureKeys(c.env.TANG_KEYS);
  if (info.sign.length === 0 || info.payload.length === 0) {
    return c.text("Internal Server Error", 500);
  }

  const key = await findKeyByThumbprint(info, thp);
  if (!key) {
    return c.text("Not Found", 404);
  }
  if (!isValidForSigning(key)) {
    return c.text("Not Found", 404);
  }

  // Sign with both default signing keys and the requested key
  const allSigners = [...info.sign];
  const alreadyIncluded = info.sign.some(
    (s) => s.x === key.x && s.y === key.y,
  );
  if (!alreadyIncluded) {
    allSigners.push(key);
  }

  const jws = await signAdvertisement(info.payload, allSigners);
  return c.json(jws, 200, {
    "Content-Type": "application/jose+json",
  });
});

export default adv;
