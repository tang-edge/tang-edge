#!/usr/bin/env bash
# Tang-edge Docker deploy entrypoint.
# Usage: docker run --rm -e <CREDENTIALS> ghcr.io/tang-edge/tang-edge <platform>
set -e

PLATFORM=${1:-}

show_help() {
  cat <<EOF
Usage: docker run --rm \\
         -e <CREDENTIALS> \\
         ghcr.io/tang-edge/tang-edge <platform>

Platforms:
  cloudflare    Cloudflare Workers
                  env: CLOUDFLARE_API_TOKEN
  deno          Deno Deploy
                  env: DENO_DEPLOY_TOKEN
                  opt: DENO_PROJECT (default: tang-edge)
  vercel        Vercel Functions
                  env: VERCEL_TOKEN, VERCEL_ORG_ID, VERCEL_PROJECT_ID
  netlify       Netlify Functions
                  env: NETLIFY_AUTH_TOKEN, NETLIFY_SITE_ID
  supabase      Supabase Edge Functions
                  env: SUPABASE_ACCESS_TOKEN
                  run first: supabase link --project-ref <ref>
  azure         Azure Functions
                  env: AZURE_FUNCTION_APP_NAME
                  run first: az login (or set AZURE_CLIENT_ID/SECRET/TENANT)
  fastly        Fastly Compute
                  env: FASTLY_API_TOKEN

Examples:
  docker run --rm -e CLOUDFLARE_API_TOKEN=\$TOKEN \\
    ghcr.io/tang-edge/tang-edge cloudflare

  docker run --rm -e DENO_DEPLOY_TOKEN=\$TOKEN \\
    ghcr.io/tang-edge/tang-edge deno

  docker run --rm \\
    -e VERCEL_TOKEN=\$TOKEN \\
    -e VERCEL_ORG_ID=\$ORG_ID \\
    -e VERCEL_PROJECT_ID=\$PROJECT_ID \\
    ghcr.io/tang-edge/tang-edge vercel
EOF
}

case "$PLATFORM" in
  cloudflare)
    : "${CLOUDFLARE_API_TOKEN:?Set CLOUDFLARE_API_TOKEN}"
    exec bun run deploy
    ;;

  deno)
    : "${DENO_DEPLOY_TOKEN:?Set DENO_DEPLOY_TOKEN}"
    exec deployctl deploy \
      --project="${DENO_PROJECT:-tang-edge}" \
      --token="${DENO_DEPLOY_TOKEN}" \
      src/platforms/deno.ts
    ;;

  vercel)
    : "${VERCEL_TOKEN:?Set VERCEL_TOKEN}"
    exec vercel --prod --yes --token="${VERCEL_TOKEN}"
    ;;

  netlify)
    : "${NETLIFY_AUTH_TOKEN:?Set NETLIFY_AUTH_TOKEN}"
    : "${NETLIFY_SITE_ID:?Set NETLIFY_SITE_ID}"
    exec netlify deploy --prod \
      --auth="${NETLIFY_AUTH_TOKEN}" \
      --site="${NETLIFY_SITE_ID}"
    ;;

  supabase)
    : "${SUPABASE_ACCESS_TOKEN:?Set SUPABASE_ACCESS_TOKEN}"
    supabase login --token "${SUPABASE_ACCESS_TOKEN}"
    exec supabase functions deploy tang-edge --no-verify-jwt
    ;;

  azure)
    : "${AZURE_FUNCTION_APP_NAME:?Set AZURE_FUNCTION_APP_NAME}"
    exec func azure functionapp publish "${AZURE_FUNCTION_APP_NAME}"
    ;;

  fastly)
    : "${FASTLY_API_TOKEN:?Set FASTLY_API_TOKEN}"
    exec fastly compute publish --token="${FASTLY_API_TOKEN}"
    ;;

  *)
    show_help
    exit 1
    ;;
esac
