// SPDX-License-Identifier: GPL-3.0-only
// Copyright (c) tang-edge contributors

/**
 * Simple fuzz runner using random input generation.
 * Runs each fuzz target with random data for a fixed number of iterations.
 *
 * Usage: bun run tests/fuzz/run-fuzz.ts [iterations]
 */
import { fuzzBase64url } from "./fuzz-base64url";
import { fuzzJwkValidate } from "./fuzz-jwk-validate";
import { fuzzEcmr } from "./fuzz-ecmr";

const ITERATIONS = Number.parseInt(process.argv[2] || "10000", 10);
const MAX_SIZE = 512;

function randomBuffer(): Buffer {
  const size = Math.floor(Math.random() * MAX_SIZE);
  const buf = Buffer.alloc(size);
  for (let i = 0; i < size; i++) {
    buf[i] = Math.floor(Math.random() * 256);
  }
  return buf;
}

async function runTarget(name: string, fn: (data: Buffer) => void | Promise<void>) {
  let errors = 0;
  const start = performance.now();

  for (let i = 0; i < ITERATIONS; i++) {
    try {
      await fn(randomBuffer());
    } catch (e) {
      errors++;
      console.error(`[${name}] Crash at iteration ${i}:`, e);
      process.exit(1);
    }
  }

  const elapsed = (performance.now() - start).toFixed(0);
  console.log(`[${name}] ${ITERATIONS} iterations, ${elapsed}ms, ${errors} crashes`);
}

console.log(`Fuzzing with ${ITERATIONS} iterations per target...\n`);

await runTarget("base64url", fuzzBase64url);
await runTarget("jwk-validate", fuzzJwkValidate);
await runTarget("ecmr", fuzzEcmr);

console.log("\nAll fuzz targets passed.");
