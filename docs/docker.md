# Docker Deploy

Deploy tang-edge to any platform without installing platform CLIs locally — just Docker.

The `ghcr.io/tang-edge/tang-edge` image bundles all deployment tools:
wrangler, deployctl, vercel, netlify-cli, supabase, azure-functions-core-tools, fastly.

## Prerequisites

- Docker installed
- Credentials for your target platform (API tokens)

## Usage

```bash
docker run --rm \
  -e <CREDENTIALS> \
  ghcr.io/tang-edge/tang-edge <platform>
```

## Per-Platform Examples

### Cloudflare Workers

```bash
docker run --rm \
  -e CLOUDFLARE_API_TOKEN=your_token \
  ghcr.io/tang-edge/tang-edge cloudflare
```

Get your token: Cloudflare dashboard → My Profile → API Tokens → Create Token (Workers: Edit).

### Deno Deploy

```bash
docker run --rm \
  -e DENO_DEPLOY_TOKEN=your_token \
  -e DENO_PROJECT=tang-edge \
  ghcr.io/tang-edge/tang-edge deno
```

Get your token: [Deno Deploy dashboard](https://dash.deno.com/account#access-tokens) → New Access Token.

### Vercel

```bash
docker run --rm \
  -e VERCEL_TOKEN=your_token \
  -e VERCEL_ORG_ID=your_org_id \
  -e VERCEL_PROJECT_ID=your_project_id \
  ghcr.io/tang-edge/tang-edge vercel
```

Get IDs: `vercel link` locally once, then read `.vercel/project.json`.

### Netlify

```bash
docker run --rm \
  -e NETLIFY_AUTH_TOKEN=your_token \
  -e NETLIFY_SITE_ID=your_site_id \
  ghcr.io/tang-edge/tang-edge netlify
```

Get token: [Netlify dashboard](https://app.netlify.com/user/applications#personal-access-tokens) → Personal access tokens.

### Supabase Edge Functions

```bash
docker run --rm \
  -e SUPABASE_ACCESS_TOKEN=your_token \
  ghcr.io/tang-edge/tang-edge supabase
```

> **Note**: Run `supabase link --project-ref <ref>` once locally first — it writes `supabase/config.toml` which must be present in the repo.

### Azure Functions

```bash
docker run --rm \
  -e AZURE_CLIENT_ID=your_client_id \
  -e AZURE_CLIENT_SECRET=your_secret \
  -e AZURE_TENANT_ID=your_tenant_id \
  -e AZURE_FUNCTION_APP_NAME=your_function_app \
  ghcr.io/tang-edge/tang-edge azure
```

Uses [service principal auth](https://learn.microsoft.com/cli/azure/authenticate-azure-cli-service-principal).

### Fastly Compute

```bash
docker run --rm \
  -e FASTLY_API_TOKEN=your_token \
  ghcr.io/tang-edge/tang-edge fastly
```

Get token: Fastly console → Account → Personal API tokens.

## Docker Compose

Copy `docker-compose.yml` from the repo root, fill in your credentials, then:

```bash
# Deploy to Cloudflare
docker compose run --rm cloudflare

# Deploy to multiple platforms
docker compose run --rm cloudflare
docker compose run --rm deno
```

Or use a `.env` file for credentials (never commit it):

```bash
# .env
CLOUDFLARE_API_TOKEN=your_token
DENO_DEPLOY_TOKEN=your_token
VERCEL_TOKEN=your_token
VERCEL_ORG_ID=your_org
VERCEL_PROJECT_ID=your_project
NETLIFY_AUTH_TOKEN=your_token
NETLIFY_SITE_ID=your_site
SUPABASE_ACCESS_TOKEN=your_token
FASTLY_API_TOKEN=your_token
```

```bash
docker compose --env-file .env run --rm cloudflare
```

## AWS Lambda / GCP Cloud Functions

AWS SAM CLI and gcloud are not included in the image (too large).
Use the standard platform guides instead:

- [AWS Lambda](aws-lambda.md)
- [GCP Cloud Functions](gcp.md)

## CI/CD Usage

```yaml
# GitHub Actions example (Cloudflare)
- uses: docker/login-action@v3
  with:
    registry: ghcr.io
    username: ${{ github.actor }}
    password: ${{ secrets.GITHUB_TOKEN }}

- run: |
    docker run --rm \
      -e CLOUDFLARE_API_TOKEN=${{ secrets.CLOUDFLARE_API_TOKEN }} \
      ghcr.io/tang-edge/tang-edge:latest cloudflare
```

## Image Tags

| Tag | Description |
|-----|-------------|
| `latest` | Latest release |
| `1`, `1.2`, `1.2.3` | Pinned to major/minor/patch |

Images are signed with Sigstore/SLSA provenance — verify with:

```bash
gh attestation verify oci://ghcr.io/tang-edge/tang-edge:latest \
  --repo tang-edge/tang-edge
```
