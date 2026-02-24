/**
 * Supabase Edge Functions entry point for tang-edge.
 *
 * Postgres table schema:
 *   CREATE TABLE tang_keys (key TEXT PRIMARY KEY, value TEXT NOT NULL);
 *
 * Environment variables:
 *   SUPABASE_URL              - auto-provided by Supabase
 *   SUPABASE_SERVICE_ROLE_KEY - auto-provided by Supabase
 *   ROTATE_TOKEN              - set via: supabase secrets set ROTATE_TOKEN=<token>
 */
import { app } from "../index";
import { SupabaseStorage } from "../storage/adapters/supabase";
import type { Env } from "../storage/types";

const supabaseUrl = Deno.env.get("SUPABASE_URL");
const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
if (!supabaseUrl || !serviceRoleKey) {
  throw new Error("Missing required env: SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY");
}

const storage = new SupabaseStorage(supabaseUrl, serviceRoleKey);

const env: Env = {
  TANG_KEYS: storage,
  ROTATE_TOKEN: Deno.env.get("ROTATE_TOKEN"),
};

Deno.serve((req) => app.fetch(req, env));
