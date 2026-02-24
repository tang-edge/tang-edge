# Supabase Edge Functions

## Deploy

```bash
npm i -g supabase
supabase login
supabase init
supabase functions deploy tang-edge --no-verify-jwt
```

## Database Setup

Create the table in Supabase SQL Editor:

```sql
CREATE TABLE tang_keys (
  key TEXT PRIMARY KEY,
  value TEXT NOT NULL
);

-- Disable RLS (edge function uses service role key)
ALTER TABLE tang_keys DISABLE ROW LEVEL SECURITY;
```

## Environment Variables

Set via Supabase CLI:

```bash
supabase secrets set ROTATE_TOKEN=$(openssl rand -hex 32)
```

Auto-provided by Supabase (no setup needed):

| Variable | Description |
|----------|-------------|
| `SUPABASE_URL` | Project URL |
| `SUPABASE_SERVICE_ROLE_KEY` | Service role key (full access) |

## Security Hardening

Supabase doesn't have built-in WAF. Use Cloudflare proxy:

```
DNS: tang.example.com → CNAME → YOUR_PROJECT.supabase.co (proxied)
```

Then apply WAF rules from the [Cloudflare guide](cloudflare.md#waf-rules).

### Database Security

- `tang_keys` table has RLS disabled — only the edge function (service role) can access it
- The service role key never leaves Supabase infrastructure
- Enable Point-in-Time Recovery for backup: Dashboard → Database → Backups

## Key Management

Via Supabase SQL Editor or CLI:

```sql
-- List all keys
SELECT key FROM tang_keys;

-- Delete a key (full revocation)
DELETE FROM tang_keys WHERE key = '<thp>.jwk';
```
