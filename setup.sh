#!/usr/bin/env bash
set -e

PLATFORM_FILE=".tang-platform"

install_bun() {
  if ! command -v bun &>/dev/null; then
    echo "Installing Bun..."
    curl -fsSL https://bun.sh/install | bash -s "bun-v1.2.4"
    export PATH="$HOME/.bun/bin:$PATH"
  fi
  echo "Installing dependencies..."
  bun install
}

gen_token() {
  if command -v openssl &>/dev/null; then
    openssl rand -hex 32
  else
    head -c 32 /dev/urandom | xxd -p | tr -d '\n'
  fi
}

save_token() {
  local token="$1"
  echo "$token" > .rotate-token
  chmod 600 .rotate-token
  echo "ROTATE_TOKEN saved to .rotate-token (chmod 600)"
  echo "  View with: cat .rotate-token"
}

save_platform() {
  echo "$1" > "$PLATFORM_FILE"
}

# ─── Update mode ───────────────────────────────────────────────
do_update() {
  local platform="$1"
  echo ""
  echo "==================================="
  echo "  Tang-Edge Update"
  echo "==================================="
  echo ""
  echo "Platform: $platform"
  echo ""

  echo "Pulling latest code..."
  git pull --ff-only || { echo "ERROR: git pull failed. Resolve conflicts manually."; exit 1; }

  echo ""
  install_bun

  echo ""
  echo "Running tests..."
  bun test || { echo "ERROR: Tests failed. Aborting deploy."; exit 1; }

  echo ""
  case "$platform" in
    cloudflare)
      echo "Deploying to Cloudflare Workers..."
      bun run deploy
      ;;
    deno)
      echo "Deploying to Deno Deploy..."
      deployctl deploy --project=tang-edge src/platforms/deno.ts
      ;;
    vercel)
      echo "Deploying to Vercel..."
      vercel --prod
      ;;
    aws)
      echo "Re-deploying AWS Lambda..."
      echo "Use your deployment tool (SAM/SST/Serverless) to redeploy."
      echo "Code updated, dependencies installed, tests passed."
      ;;
    gcp)
      echo "Deploying to GCP..."
      PROJECT=$(gcloud config get project 2>/dev/null)
      TOKEN=$(cat .rotate-token 2>/dev/null || echo "")
      gcloud functions deploy tang-edge \
        --runtime=nodejs20 \
        --trigger-http \
        --allow-unauthenticated \
        --source=. \
        --set-env-vars="GCP_PROJECT=$PROJECT,ROTATE_TOKEN=$TOKEN" \
        --region=europe-west1
      ;;
    netlify)
      echo "Deploying to Netlify..."
      netlify deploy --prod
      ;;
    azure)
      echo "Re-deploying Azure Functions..."
      echo "Use: func azure functionapp publish <your-function-app-name>"
      echo "Code updated, dependencies installed, tests passed."
      ;;
    supabase)
      echo "Deploying to Supabase..."
      supabase functions deploy tang-edge --no-verify-jwt
      ;;
    *)
      echo "Unknown platform: $platform"
      exit 1
      ;;
  esac

  echo ""
  echo "╔═══════════════════════════════════════════════════════════╗"
  echo "║                                                           ║"
  echo "║   ✅  tang-edge updated successfully!                     ║"
  echo "║                                                           ║"
  echo "╚═══════════════════════════════════════════════════════════╝"
  exit 0
}

# ─── Check for existing installation ──────────────────────────
if [ -f "$PLATFORM_FILE" ]; then
  CURRENT=$(cat "$PLATFORM_FILE")
  echo "==================================="
  echo "  Tang-Edge Setup"
  echo "==================================="
  echo ""
  echo "Existing installation detected: $CURRENT"
  echo ""
  echo "  1) Update — git pull + test + redeploy"
  echo "  2) Fresh setup — reconfigure from scratch"
  echo ""
  read -rp "Choose [1-2]: " mode
  if [[ "$mode" == "1" ]]; then
    do_update "$CURRENT"
  fi
  echo ""
  echo "Starting fresh setup..."
  echo ""
fi

# ─── Fresh setup ───────────────────────────────────────────────
echo "==================================="
echo "  Tang-Edge Setup"
echo "==================================="
echo ""
echo "Serverless platforms:"
echo ""
echo "  1) Cloudflare Workers"
echo "  2) Deno Deploy"
echo "  3) Vercel"
echo "  4) AWS Lambda"
echo "  5) GCP Cloud Functions"
echo "  6) Netlify Functions"
echo "  7) Azure Functions"
echo "  8) Supabase Edge Functions"
echo ""
read -rp "Choose platform [1-8]: " choice

case "$choice" in
  1)
    echo ""
    echo "--- Cloudflare Workers ---"
    install_bun

    if ! command -v wrangler &>/dev/null; then
      echo "wrangler not found, installing..."
      bun add -g wrangler
    fi

    echo ""
    echo "Logging in to Cloudflare..."
    wrangler login

    echo ""
    echo "Creating KV namespace..."
    KV_OUT=$(wrangler kv namespace create TANG_KEYS 2>&1)
    echo "$KV_OUT"
    KV_ID=$(echo "$KV_OUT" | grep -oP 'id = "\K[^"]+')

    PREVIEW_OUT=$(wrangler kv namespace create TANG_KEYS --preview 2>&1)
    echo "$PREVIEW_OUT"
    PREVIEW_ID=$(echo "$PREVIEW_OUT" | grep -oP 'id = "\K[^"]+')

    if [ -n "$KV_ID" ]; then
      sed -i "s/REPLACE_WITH_YOUR_KV_NAMESPACE_ID/$KV_ID/" wrangler.toml
      echo "Updated wrangler.toml with KV ID: $KV_ID"
    fi
    if [ -n "$PREVIEW_ID" ]; then
      sed -i "s/REPLACE_WITH_YOUR_PREVIEW_KV_NAMESPACE_ID/$PREVIEW_ID/" wrangler.toml
      echo "Updated wrangler.toml with preview ID: $PREVIEW_ID"
    fi

    echo ""
    echo "Setting ROTATE_TOKEN secret..."
    TOKEN=$(gen_token)
    echo "$TOKEN" | wrangler secret put ROTATE_TOKEN
    save_token "$TOKEN"

    echo ""
    read -rp "Deploy now? [y/N]: " deploy
    if [[ "$deploy" =~ ^[Yy]$ ]]; then
      bun run deploy
    fi

    save_platform "cloudflare"
    echo ""
    echo "Done! Run 'bun run deploy' to deploy."
    ;;

  2)
    echo ""
    echo "--- Deno Deploy ---"

    if ! command -v deno &>/dev/null; then
      echo "Installing Deno..."
      curl -fsSL https://deno.land/install.sh | sh -s "v2.2.3"
      export PATH="$HOME/.deno/bin:$PATH"
    fi

    install_bun

    TOKEN=$(gen_token)
    save_token "$TOKEN"
    echo ""
    echo "Set ROTATE_TOKEN in Deno Deploy Dashboard → Settings → Environment Variables"
    echo "  Value is in .rotate-token"
    echo ""
    echo "Deploy with:"
    echo "  deployctl deploy --project=tang-edge src/platforms/deno.ts"

    save_platform "deno"
    ;;

  3)
    echo ""
    echo "--- Vercel ---"
    install_bun
    bun add @vercel/kv

    if ! command -v vercel &>/dev/null; then
      echo "Installing Vercel CLI..."
      bun add -g vercel@44
    fi

    TOKEN=$(gen_token)
    save_token "$TOKEN"
    echo ""
    echo "Steps:"
    echo "  1. Create KV Store: Vercel Dashboard → Storage → KV"
    echo "  2. Connect KV to your project"
    echo "  3. Set ROTATE_TOKEN: vercel env add ROTATE_TOKEN (value in .rotate-token)"
    echo "  4. Deploy: vercel --prod"

    save_platform "vercel"
    ;;

  4)
    echo ""
    echo "--- AWS Lambda ---"
    install_bun
    bun add @aws-sdk/client-dynamodb

    if ! command -v aws &>/dev/null; then
      echo "ERROR: AWS CLI not found. Install: https://aws.amazon.com/cli/"
      exit 1
    fi

    read -rp "AWS region [eu-central-1]: " region
    region=${region:-eu-central-1}

    echo "Creating DynamoDB table..."
    aws dynamodb create-table \
      --table-name tang-keys \
      --attribute-definitions AttributeName=pk,AttributeType=S \
      --key-schema AttributeName=pk,KeyType=HASH \
      --billing-mode PAY_PER_REQUEST \
      --region "$region" 2>&1 || echo "(table may already exist)"

    TOKEN=$(gen_token)
    save_token "$TOKEN"
    echo ""
    echo "Table: tang-keys (region: $region)"
    echo "Entry point: src/platforms/aws-lambda.ts"
    echo "Export: handler"
    echo ""
    echo "Deploy with SAM, SST, or Serverless Framework."
    echo "Set env: TANG_TABLE=tang-keys AWS_REGION=$region ROTATE_TOKEN=\$(cat .rotate-token)"

    save_platform "aws"
    ;;

  5)
    echo ""
    echo "--- GCP Cloud Functions ---"
    install_bun
    bun add @google-cloud/firestore @hono/node-server

    if ! command -v gcloud &>/dev/null; then
      echo "ERROR: gcloud CLI not found. Install: https://cloud.google.com/sdk/docs/install"
      exit 1
    fi

    echo "Enabling Firestore..."
    gcloud firestore databases create --location=europe-west1 2>&1 || echo "(database may already exist)"

    TOKEN=$(gen_token)
    PROJECT=$(gcloud config get project 2>/dev/null)

    echo ""
    read -rp "Deploy now? [y/N]: " deploy
    if [[ "$deploy" =~ ^[Yy]$ ]]; then
      gcloud functions deploy tang-edge \
        --runtime=nodejs20 \
        --trigger-http \
        --allow-unauthenticated \
        --source=. \
        --set-env-vars="GCP_PROJECT=$PROJECT,ROTATE_TOKEN=$TOKEN" \
        --region=europe-west1
    fi

    save_token "$TOKEN"
    save_platform "gcp"
    ;;

  6)
    echo ""
    echo "--- Netlify Functions ---"
    install_bun
    bun add @netlify/blobs

    if ! command -v netlify &>/dev/null; then
      echo "Installing Netlify CLI..."
      bun add -g netlify-cli@20
    fi

    TOKEN=$(gen_token)
    save_token "$TOKEN"
    echo ""
    echo "Steps:"
    echo "  1. Set env vars in Netlify Dashboard → Site settings → Environment variables:"
    echo "     NETLIFY_SITE_ID, NETLIFY_TOKEN, ROTATE_TOKEN (value in .rotate-token)"
    echo "  2. Deploy: netlify deploy --prod"

    save_platform "netlify"
    ;;

  7)
    echo ""
    echo "--- Azure Functions ---"
    install_bun
    bun add @azure/data-tables @azure/functions @marplex/hono-azurefunc-adapter

    if ! command -v az &>/dev/null; then
      echo "ERROR: Azure CLI not found. Install: https://learn.microsoft.com/cli/azure/install-azure-cli"
      exit 1
    fi

    if ! command -v func &>/dev/null; then
      echo "Installing Azure Functions Core Tools..."
      bun add -g azure-functions-core-tools@4.0 --unsafe-perm true
    fi

    read -rp "Resource group [tang-edge-rg]: " rg
    rg=${rg:-tang-edge-rg}

    read -rp "Azure region [westeurope]: " region
    region=${region:-westeurope}

    read -rp "Storage account name [tangedgestorage]: " sa
    sa=${sa:-tangedgestorage}

    echo "Creating resource group..."
    az group create --name "$rg" --location "$region" 2>&1 || echo "(may already exist)"

    echo "Creating storage account..."
    az storage account create \
      --name "$sa" \
      --resource-group "$rg" \
      --location "$region" \
      --sku Standard_LRS 2>&1 || echo "(may already exist)"

    echo "Getting connection string..."
    CONN_STR=$(az storage account show-connection-string \
      --name "$sa" \
      --resource-group "$rg" \
      --query connectionString -o tsv)

    echo "Creating table..."
    az storage table create \
      --name tangkeys \
      --connection-string "$CONN_STR" 2>&1 || echo "(table may already exist)"

    TOKEN=$(gen_token)

    echo ""
    echo "Entry point: src/platforms/azure-functions.ts"
    save_token "$TOKEN"
    echo ""
    echo "Set in Azure Function App settings:"
    echo "  AZURE_STORAGE_CONNECTION_STRING=\$CONN_STR"
    echo "  ROTATE_TOKEN=\$(cat .rotate-token)"
    echo ""
    echo "Deploy with:"
    echo "  func azure functionapp publish <your-function-app-name>"

    save_platform "azure"
    ;;

  8)
    echo ""
    echo "--- Supabase Edge Functions ---"

    if ! command -v supabase &>/dev/null; then
      echo "Installing Supabase CLI..."
      bun add -g supabase@2
    fi

    install_bun

    echo ""
    TOKEN=$(gen_token)
    echo "Steps:"
    echo "  1. Link project: supabase link --project-ref <your-project-ref>"
    echo "  2. Create table in SQL Editor:"
    echo "     CREATE TABLE tang_keys (key TEXT PRIMARY KEY, value TEXT NOT NULL);"
    echo "  3. Set secret: supabase secrets set ROTATE_TOKEN=\$(cat .rotate-token)"
    echo "  4. Deploy: supabase functions deploy tang-edge --no-verify-jwt"
    echo ""
    echo "SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY are auto-provided."
    echo "Entry point: src/platforms/supabase.ts"
    save_token "$TOKEN"

    save_platform "supabase"
    ;;

  *)
    echo "Invalid choice"
    exit 1
    ;;
esac

echo ""
echo "╔═══════════════════════════════════════════════════════════╗"
echo "║                                                           ║"
echo "║   ✅  tang-edge setup complete!                           ║"
echo "║                                                           ║"
echo "║   Test:                                                   ║"
echo "║     curl <your-url>/adv                                   ║"
echo "║                                                           ║"
echo "║   E2E with clevis:                                        ║"
echo '║     echo test | clevis encrypt tang '"'"'{"url":"<url>"}'"'"'   ║'
echo "║     clevis decrypt < enc.jwe                              ║"
echo "║                                                           ║"
echo "║   Update later:                                           ║"
echo "║     bash setup.sh                                         ║"
echo "║                                                           ║"
echo "╠═══════════════════════════════════════════════════════════╣"
echo "║                                                           ║"
echo "║   ⭐  Like tang-edge? Star the repo!                      ║"
echo "║   → https://github.com/tang-edge/tang-edge               ║"
echo "║                                                           ║"
echo "╚═══════════════════════════════════════════════════════════╝"
