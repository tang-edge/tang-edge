# Cloudflare Workers

## Prerequisites

- **Node.js >= 20** — required by wrangler v4
- **Bun** — auto-installed by `setup.sh`, or [install manually](https://bun.sh/)
- **Cloudflare account** — free tier is enough

## Authentication

**Option A** — browser OAuth (interactive):

```bash
wrangler login
```

**Option B** — API token (CI / headless):

```bash
export CLOUDFLARE_API_TOKEN="your-token"
```

Create token: [Cloudflare Dashboard → API Tokens](https://dash.cloudflare.com/profile/api-tokens) → template **"Edit Cloudflare Workers"**

## Deploy

```bash
bun install
wrangler kv namespace create TANG_KEYS
wrangler kv namespace create TANG_KEYS --preview
```

Copy the KV namespace IDs into `wrangler.toml`:

```toml
[[kv_namespaces]]
binding = "TANG_KEYS"
id = "<YOUR_KV_NAMESPACE_ID>"
preview_id = "<YOUR_KV_PREVIEW_ID>"
```

Set the rotation token and deploy:

```bash
wrangler secret put ROTATE_TOKEN
bun run deploy
```

## Custom Domain

```toml
[[routes]]
pattern = "tang.example.com"
custom_domain = true
```

## WAF Rules

Dashboard → Security → WAF → Custom Rules.

### Rate Limiting

| Rule | Expression | Action | Rate |
|------|-----------|--------|------|
| Rate limit `/rec` | `http.request.uri.path matches "^/rec/"` | Block | 10 req/min per IP |
| Rate limit `/rotate` | `http.request.uri.path eq "/rotate"` | Block | 3 req/min per IP |
| Rate limit `/adv` | `http.request.uri.path matches "^/adv"` | Block | 30 req/min per IP |

### IP Allowlist for `/rotate`

Only allow rotation from trusted IPs:

```
Expression: http.request.uri.path eq "/rotate" and not ip.src in {YOUR_ADMIN_IP}
Action: Block
```

### Block Non-Tang Traffic

```
Expression: not http.request.uri.path matches "^/(adv|rec/|rotate)?$"
Action: Block
```

## Cron Trigger (Auto-Rotation)

`wrangler.toml` includes a monthly cron trigger:

```toml
[triggers]
crons = ["0 0 1 * *"]
```

This calls the `scheduled` handler in `src/index.ts` which rotates all keys automatically.

## Smart Placement

Enabled by default in `wrangler.toml`:

```toml
[placement]
mode = "smart"
```

Routes requests to the closest Cloudflare data center with KV access for lowest latency.

## Monitoring

Dashboard → Workers → tang-edge → Logs/Analytics:
- Request count, error rate, latency percentiles
- Set up email alerts for error spikes

## Key Management

```bash
# List all keys
wrangler kv key list --namespace-id=<ID>

# Delete a specific key (full revocation)
wrangler kv key delete --namespace-id=<ID> "<thp>.jwk"

# Export a key
wrangler kv key get --namespace-id=<ID> "<thp>.jwk"
```
