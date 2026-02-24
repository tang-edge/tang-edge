# Vercel

## Deploy

```bash
bun install
npm i -g vercel
vercel login
vercel
```

## Configuration

Create `vercel.json` in project root:

```json
{
  "rewrites": [{ "source": "/(.*)", "destination": "/api" }],
  "functions": {
    "api/**": {
      "runtime": "nodejs20.x"
    }
  }
}
```

Create `api/index.ts`:

```typescript
export { default } from "../src/platforms/vercel";
```

## Environment Variables

Set in Vercel Dashboard (Settings → Environment Variables):

| Variable | Description |
|----------|-------------|
| `KV_REST_API_URL` | Vercel KV connection URL |
| `KV_REST_API_TOKEN` | Vercel KV token |
| `ROTATE_TOKEN` | Token for POST /rotate |

## Storage (Vercel KV)

1. Vercel Dashboard → Storage → Create → KV
2. Connect to your project
3. Environment variables are auto-populated

## Custom Domain

Vercel Dashboard → Settings → Domains → Add.

## Security Hardening

### Vercel Firewall (Pro plan)

Dashboard → Firewall → Add Rule:

- Rate limit `/rec` to 10 req/min per IP
- Rate limit `/rotate` to 3 req/min per IP
- IP allowlist for `/rotate`

### Free Plan Alternative

Use Cloudflare proxy:

```
DNS: tang.example.com → CNAME → your-project.vercel.app (proxied)
```

Then apply WAF rules from the [Cloudflare guide](cloudflare.md#waf-rules).

## Key Management

```bash
# Via Vercel KV CLI
vercel env pull .env.local
# Then use Redis CLI with KV_REST_API_URL
```
