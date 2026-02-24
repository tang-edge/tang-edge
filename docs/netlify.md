# Netlify Functions

## Deploy

```bash
npm i -g netlify-cli
netlify login
netlify init
netlify deploy --prod
```

## Configuration

Create `netlify.toml`:

```toml
[functions]
  directory = "netlify/functions"

[[redirects]]
  from = "/*"
  to = "/.netlify/functions/tang"
  status = 200
```

Create `netlify/functions/tang.ts`:

```typescript
export { default } from "../../src/platforms/netlify";
```

## Environment Variables

Set in Netlify Dashboard (Site Settings → Environment Variables):

| Variable | Description |
|----------|-------------|
| `NETLIFY_SITE_ID` | Netlify site ID |
| `NETLIFY_TOKEN` | Netlify API token (for Blobs access) |
| `ROTATE_TOKEN` | Token for POST /rotate |

## Storage (Netlify Blobs)

Netlify Blobs is used automatically. Store name: `tang-keys`.

To get your API token:
1. Netlify Dashboard → User Settings → Applications → Personal Access Tokens
2. Create new token with full access

## Security Hardening

Netlify doesn't have built-in WAF on free plan. Use Cloudflare proxy:

```
DNS: tang.example.com → CNAME → your-site.netlify.app (proxied)
```

Then apply WAF rules from the [Cloudflare guide](cloudflare.md#waf-rules).

## Key Management

Keys are stored in Netlify Blobs. Access via Netlify CLI:

```bash
# List blobs
netlify blobs:list tang-keys

# Delete a key (full revocation)
netlify blobs:delete tang-keys <thp>.jwk
```
