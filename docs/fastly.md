# Fastly Compute

## Prerequisites

- [Fastly CLI](https://developer.fastly.com/reference/cli/) installed
- Fastly account (free tier available)

## Deploy

```bash
# Login
fastly auth login

# Create a new Compute service (first time)
fastly compute init

# Deploy
fastly compute publish
```

## KV Store Setup

Fastly KV Store must be created and linked to your service before deploying.

1. Create the KV Store:

```bash
fastly kv-store create --name tang-keys
```

2. Note the Store ID from the output, then link it to your service in `fastly.toml`:

```toml
[setup.kv_stores.tang-keys]
name = "tang-keys"
```

## Environment Variables

Fastly uses Config Stores for environment variables:

```bash
# Create a Config Store
fastly config-store create --name tang-config

# Add ROTATE_TOKEN
fastly config-store entry create \
  --store-name tang-config \
  --key ROTATE_TOKEN \
  --value "$(openssl rand -hex 32)"
```

Link the Config Store in `fastly.toml`:

```toml
[setup.config_stores.tang-config]
name = "tang-config"
```

In `src/platforms/fastly.ts` the token is read via `env("ROTATE_TOKEN")` — update to use a Config Store entry if needed.

| Variable | Description |
|----------|-------------|
| `ROTATE_TOKEN` | Token for POST /rotate (min 32 chars, cryptographically random) |

## Storage

Uses Fastly KV Store. Keys are indexed via an internal `__index__` entry — do not delete it manually.

**View keys:**

```bash
fastly kv-store entry list --store-name tang-keys
```

**Delete a key (full revocation):**

```bash
fastly kv-store entry delete --store-name tang-keys --key "<thp>.jwk"
fastly kv-store entry delete --store-name tang-keys --key "__index__"
# Re-generate index on next write
```

## Security Hardening

Fastly Compute has built-in edge network. To restrict `/rec/*` to a specific IP:

1. Fastly console → Service → Conditions → Add request condition:
   - Apply to: `recv`
   - Condition: `client.ip != "YOUR_VPS_IP"`
   - Action: Synth 403

Or use [Fastly Next-Gen WAF](https://docs.fastly.com/products/ngwaf) for advanced rules.

## Key Management

```bash
# List all stored keys
fastly kv-store entry list --store-name tang-keys

# Backup public advertisement
curl https://YOUR_SERVICE.edgecompute.app/adv | jq . > tang-adv-backup.json
```
