#!/usr/bin/env bash
# Tang-edge Docker deploy entrypoint.
#
# Interactive mode (preferred):
#   docker run -it --rm ghcr.io/tang-edge/tang-edge
#   # then: bash setup.sh
#
# One-shot CI mode:
#   docker run --rm -e CLOUDFLARE_API_TOKEN=xxx ghcr.io/tang-edge/tang-edge cloudflare
#
set -e

PLATFORM=${1:-}

show_help() {
  cat <<EOF

Tang-edge deploy image — all platform CLIs pre-installed.

─── Interactive mode ────────────────────────────────────────
  docker run -it --rm ghcr.io/tang-edge/tang-edge
  # Opens bash shell, then run:
  bash setup.sh

─── One-shot CI mode ────────────────────────────────────────
  docker run --rm -e <CREDENTIALS> ghcr.io/tang-edge/tang-edge <platform>

  Platforms:
    cloudflare  env: CLOUDFLARE_API_TOKEN
    deno        env: DENO_DEPLOY_TOKEN [DENO_PROJECT]
    vercel      env: VERCEL_TOKEN, VERCEL_ORG_ID, VERCEL_PROJECT_ID
    netlify     env: NETLIFY_AUTH_TOKEN, NETLIFY_SITE_ID
    supabase    env: SUPABASE_ACCESS_TOKEN
    azure       env: AZURE_FUNCTION_APP_NAME [AZURE_CLIENT_ID/SECRET/TENANT]
    fastly      env: FASTLY_API_TOKEN
    aws         env: AWS_ACCESS_KEY_ID, AWS_SECRET_ACCESS_KEY,
                     AWS_DEFAULT_REGION, AWS_LAMBDA_FUNCTION_NAME

  See docs/docker.md for all options and docker-compose.yml.

EOF
}

case "$PLATFORM" in
  "")
    # No argument — start interactive bash shell
    echo ""
    echo "Tang-edge deploy environment. All platform CLIs are installed."
    echo "Run: bash setup.sh"
    echo ""
    exec /bin/bash
    ;;

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

  aws)
    : "${AWS_ACCESS_KEY_ID:?Set AWS_ACCESS_KEY_ID}"
    : "${AWS_SECRET_ACCESS_KEY:?Set AWS_SECRET_ACCESS_KEY}"
    : "${AWS_DEFAULT_REGION:?Set AWS_DEFAULT_REGION}"
    : "${AWS_LAMBDA_FUNCTION_NAME:?Set AWS_LAMBDA_FUNCTION_NAME}"
    echo "Bundling Lambda handler..."
    bun build src/platforms/aws-lambda.ts \
      --target=node \
      --outfile=dist/lambda.js \
      --external @aws-sdk
    cd dist
    zip -r lambda.zip lambda.js ../node_modules
    cd ..
    echo "Updating Lambda function code..."
    exec aws lambda update-function-code \
      --function-name "${AWS_LAMBDA_FUNCTION_NAME}" \
      --zip-file fileb://dist/lambda.zip
    ;;

  help|--help|-h)
    show_help
    ;;

  *)
    echo "Unknown platform: $PLATFORM"
    show_help
    exit 1
    ;;
esac
