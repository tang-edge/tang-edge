# Deno Deploy

## Deploy

```bash
# Install deployctl
deno install -Arf jsr:@deno/deployctl

# Set environment variables in Deno Deploy dashboard first, then:
deployctl deploy --project=tang-edge src/platforms/deno.ts
```

## Environment Variables

Set in Deno Deploy dashboard (Settings → Environment Variables):

| Variable | Description |
|----------|-------------|
| `ROTATE_TOKEN` | Token for POST /rotate (min 32 chars, cryptographically random) |

## Storage

Uses Deno KV (built-in, no setup needed). Data is automatically replicated across regions.

## Custom Domain

Deno Deploy dashboard → Settings → Domains → Add Domain.

## Security Hardening

Deno Deploy doesn't have built-in WAF. Options:

1. **Cloudflare proxy**: Point your domain through Cloudflare (free plan) for WAF + rate limiting
2. **Application-level**: tang-edge already includes:
   - 4 KB request body limit on `/rec`
   - Timing-safe token comparison on `/rotate`
   - Input validation (curve, coordinates, key type)

### Cloudflare Proxy Setup

```
DNS: tang.example.com → CNAME → tang-edge.deno.dev (proxied, orange cloud)
```

Then apply WAF rules from the [Cloudflare guide](cloudflare.md#waf-rules).

## Key Management

Keys are stored in Deno KV. Access via Deno Deploy dashboard or programmatically:

```typescript
const kv = await Deno.openKv();

// List all keys
for await (const entry of kv.list({ prefix: [] })) {
  console.log(entry.key, entry.value);
}

// Delete a key (full revocation)
await kv.delete(["<thp>.jwk"]);
```
