import { ecmrExchange } from "../../src/crypto/ecmr";
import { generateExchangeKey } from "../../src/crypto/keygen";
import type { ECPublicJWK, ECPrivateJWK } from "../../src/storage/types";

// Pre-generate a valid server key (reused across fuzz iterations)
let serverKey: ECPrivateJWK | null = null;

async function getServerKey(): Promise<ECPrivateJWK> {
  if (!serverKey) {
    serverKey = await generateExchangeKey();
  }
  return serverKey;
}

/**
 * Fuzz target: ECMR exchange with arbitrary client public key.
 * Ensures ecmrExchange rejects invalid points without crashing.
 */
export async function fuzzEcmr(data: Buffer): Promise<void> {
  if (data.length < 132) return; // Need at least 66+66 bytes for x,y

  const server = await getServerKey();

  // Build a client key from fuzz data
  const xBytes = data.subarray(0, 66);
  const yBytes = data.subarray(66, 132);

  // Convert to base64url
  const x = Buffer.from(xBytes).toString("base64url");
  const y = Buffer.from(yBytes).toString("base64url");

  const clientKey: ECPublicJWK = {
    kty: "EC",
    crv: "P-521",
    x,
    y,
    key_ops: ["deriveKey"],
    alg: "ECMR",
  };

  try {
    ecmrExchange(server, clientKey);
  } catch {
    // Invalid point — expected, @noble/curves validates and throws
  }
}
