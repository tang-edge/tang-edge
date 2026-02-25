# tang-edge

[![CI](https://github.com/tang-edge/tang-edge/actions/workflows/ci.yml/badge.svg)](https://github.com/tang-edge/tang-edge/actions/workflows/ci.yml)
[![CodeQL](https://github.com/tang-edge/tang-edge/actions/workflows/codeql.yml/badge.svg)](https://github.com/tang-edge/tang-edge/actions/workflows/codeql.yml)
[![Codecov](https://codecov.io/gh/tang-edge/tang-edge/graph/badge.svg)](https://codecov.io/gh/tang-edge/tang-edge)
[![Quality Gate](https://sonarcloud.io/api/project_badges/measure?project=tang-edge-org_tang-edge&metric=alert_status)](https://sonarcloud.io/summary/new_code?id=tang-edge-org_tang-edge)
[![Security Rating](https://sonarcloud.io/api/project_badges/measure?project=tang-edge-org_tang-edge&metric=security_rating)](https://sonarcloud.io/summary/new_code?id=tang-edge-org_tang-edge)
[![Maintainability](https://sonarcloud.io/api/project_badges/measure?project=tang-edge-org_tang-edge&metric=sqale_rating)](https://sonarcloud.io/summary/new_code?id=tang-edge-org_tang-edge)
[![Snyk](https://snyk.io/test/github/tang-edge/tang-edge/badge.svg)](https://snyk.io/test/github/tang-edge/tang-edge)
[![License: GPL-3.0](https://img.shields.io/badge/License-GPL_3.0-blue.svg)](LICENSE)
[![TypeScript](https://img.shields.io/badge/TypeScript-5-blue?logo=typescript)](tsconfig.json)
[![Hono](https://img.shields.io/badge/Hono-E36002?logo=hono&logoColor=white)](https://hono.dev)
[![Bun](https://img.shields.io/badge/Bun-black?logo=bun&logoColor=white)](https://bun.sh)
[![Platforms](https://img.shields.io/badge/platforms-8-brightgreen)]()
[![OpenSSF Best Practices](https://www.bestpractices.dev/projects/12036/badge)](https://www.bestpractices.dev/projects/12036)
[![OpenSSF Scorecard](https://api.scorecard.dev/projects/github.com/tang-edge/tang-edge/badge)](https://scorecard.dev/viewer/?uri=github.com/tang-edge/tang-edge)

Tang server for serverless/edge platforms. Deploy across multiple free providers and use `clevis sss` to distribute trust — no single provider can decrypt your disks.

Full [Tang](https://github.com/latchset/tang) protocol (P-521 ECMR) in TypeScript, compatible with standard `clevis` clients for automatic disk encryption unlock.

## Why

Original [tang](https://github.com/latchset/tang) runs on a server you maintain. tang-edge runs on free serverless — zero ops, no VPS, no patching.

The real power is **Split Trust**: deploy tang-edge to 2-3 different providers, use `clevis sss` with a threshold. No single provider can decrypt. Physical theft + cloud compromise both needed. Free.

### Comparison

| | tang-edge | [tang](https://github.com/latchset/tang) (original) | AWS KMS / Vault |
|---|-----------|------------------------------------------------------|-----------------|
| Infrastructure | None (serverless free tier) | VPS / bare metal | Managed service |
| Ops burden | Zero — no patching, no uptime | You maintain the server | Vendor manages |
| Split Trust cost | Free (2-3 free edge accounts) | 2-3 VPS ($5-20/mo each) | $$$, vendor lock-in |
| Kill switch | Disable worker → disk locked on next reboot | Shut down server → same | Revoke key → same |
| Protocol | Standard Tang (clevis-compatible) | Standard Tang | Proprietary API |
| Latency | <50ms (300+ edge locations) | Depends on server location | ~100ms |
| Compliance | Helps meet GDPR, HIPAA, PCI-DSS | Same | Built-in certifications |
| When to use | Remote servers, homelab, NAS, VPS | On-prem with local network | Enterprise with budget |

## Supported Platforms

| Platform | Storage | Guide |
|----------|---------|-------|
| Cloudflare Workers | KV | [Deploy + WAF](docs/cloudflare.md) |
| Deno Deploy | Deno KV | [Deploy](docs/deno-deploy.md) |
| Vercel | Vercel KV | [Deploy](docs/vercel.md) |
| AWS Lambda | DynamoDB | [Deploy + WAF](docs/aws-lambda.md) |
| GCP Cloud Functions | Firestore | [Deploy + Cloud Armor](docs/gcp.md) |
| Netlify Functions | Blobs | [Deploy](docs/netlify.md) |
| Azure Functions | Table Storage | [Deploy + Front Door](docs/azure.md) |
| Supabase Edge Functions | Postgres | [Deploy](docs/supabase.md) |

> For VPS/Docker use the original [tang](https://github.com/latchset/tang) — it's simpler and runs natively.

## Quick Start

```bash
bash setup.sh
```

Interactive wizard: picks platform, installs deps, configures storage, deploys.

## Split Trust (SSS)

The main use case. Deploy to 2+ providers, require all for decryption:

```bash
clevis luks bind -d /dev/sdX sss '{
  "t": 2,
  "pins": {
    "tang": [
      {"url": "https://tang-edge.example.workers.dev"},
      {"url": "https://tang-edge.deno.dev"}
    ]
  }
}'
```

Kill switch: disable any one provider — disk stays locked on next reboot.

See [Split Trust Examples](docs/split-trust.md) for production deployment patterns: 2-of-2, 2-of-3 with LAN, 3 cloud providers, offsite backups, and threat model tables.

### Single Server

```bash
clevis luks bind -d /dev/sdX tang '{"url":"https://tang-edge.example.workers.dev"}'
```

## API

| Endpoint | Method | Description |
|----------|--------|-------------|
| `/adv` | GET | JWS advertisement with public keys |
| `/adv/:thp` | GET | Advertisement signed by specific key |
| `/rec/:thp` | POST | ECMR key recovery (clevis calls this at boot) |
| `/rotate` | POST | Rotate all keys (requires `Authorization: Bearer <token>`) |
| `/` | GET | Health check |

## Development

```bash
bun run dev           # wrangler dev (CF emulator)
bun run dev-server.ts # standalone (in-memory storage)
bun test              # 176 tests
```

## Architecture

```
src/
├── index.ts              # Hono app + Cloudflare Workers entry point
├── crypto/
│   ├── ecmr.ts           # P-521 ECMR (@noble/curves)
│   ├── jwk-utils.ts      # JWK thumbprint, validation
│   ├── jws.ts            # JWS signing (ES512)
│   └── keygen.ts         # Key pair generation
├── routes/
│   ├── adv.ts            # GET /adv, GET /adv/:thp
│   ├── rec.ts            # POST /rec/:thp
│   └── rotate.ts         # POST /rotate
├── storage/
│   ├── interface.ts      # TangStorage interface
│   ├── kv-store.ts       # Key management (CRUD, rotation)
│   ├── types.ts          # TypeScript types
│   └── adapters/         # CloudflareKV, DenoKV, DynamoDB, Firestore,
│                         # NetlifyBlobs, AzureTable, VercelKV,
│                         # Supabase, FileSystem, Memory
└── platforms/            # Entry points per provider
    ├── deno.ts
    ├── aws-lambda.ts
    ├── gcp.ts
    ├── netlify.ts
    ├── azure-functions.ts
    ├── vercel.ts
    ├── supabase.ts
    └── bun.ts
```

## How it Works

1. **Setup**: `clevis luks bind` fetches Tang's public keys and encrypts a secret into the LUKS header
2. **Boot**: `clevis luks unlock` sends a blinded key to `/rec/:thp`, Tang performs ECMR (EC Multiply-and-Replace), returns the result
3. **Unlock**: clevis unblinds the response to recover the original secret → LUKS decrypts the disk

The server never sees the actual encryption key — it only performs a mathematical operation on blinded data. This is why Tang public keys are safe to expose and why the protocol is secure by design.

## Client Setup

See [clevis documentation](https://github.com/latchset/clevis) for LUKS binding. tang-edge is a standard Tang server — any clevis client works without modifications.

## Security

- **Tang protocol is safe by design** — public keys are not secret, ECMR is useless without the LUKS header
- **ROTATE_TOKEN** — set as secret/env var, never in config files
- **WAF recommended** — IP whitelist + rate limiting on your edge platform (e.g. Cloudflare WAF)
- **Kill switch** — disable the worker/function to prevent unlock on next reboot (already-running machines are unaffected; for immediate lock use `cryptsetup close` via SSH)
- **Split trust** — combine multiple providers with `clevis sss`
- **Timing-safe token comparison** — rotation endpoint uses constant-time equality
- **Input validation** — curve, coordinates, and key type are strictly checked

See [SECURITY.md](SECURITY.md) for vulnerability reporting.

## Compliance

LUKS disk encryption with Network-Bound Disk Encryption (NBDE) helps satisfy data-at-rest encryption requirements across regulatory frameworks:

- **GDPR** (Art. 32) — appropriate technical measures for data protection
- **HIPAA** (§164.312) — encryption of electronic protected health information
- **PCI-DSS** (Req. 3.4) — render stored cardholder data unreadable

Split Trust across providers adds defense-in-depth: no single cloud compromise exposes encryption keys.

> tang-edge is a cryptographic tool, not a certified product. Consult your compliance team for audit-specific requirements.

## License

GPL-3.0-only
