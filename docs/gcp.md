# GCP Cloud Functions

## Deploy

```bash
gcloud auth login
gcloud config set project YOUR_PROJECT_ID

gcloud functions deploy tang-edge \
  --gen2 \
  --runtime=nodejs20 \
  --trigger-http \
  --allow-unauthenticated \
  --source=. \
  --entry-point=default \
  --set-env-vars="GCP_PROJECT=YOUR_PROJECT_ID,ROTATE_TOKEN=$(openssl rand -hex 32)" \
  --region=europe-west1
```

## Environment Variables

| Variable | Description |
|----------|-------------|
| `GCP_PROJECT` | Google Cloud project ID (required) |
| `ROTATE_TOKEN` | Token for POST /rotate |
| `PORT` | Listen port (default: `8080`, auto-set by GCP) |

## Storage (Firestore)

1. Enable Firestore in Native mode:

```bash
gcloud firestore databases create --location=europe-west1
```

2. Collection `tang-keys` is created automatically on first use.

Document format:
```json
{
  "value": "<JWK JSON string>"
}
```

## Security Hardening

### Cloud Armor (WAF)

```bash
# Create security policy
gcloud compute security-policies create tang-edge-policy

# Rate limiting
gcloud compute security-policies rules create 1000 \
  --security-policy=tang-edge-policy \
  --expression="request.path.matches('/rec/.*')" \
  --action=rate-based-ban \
  --rate-limit-threshold-count=10 \
  --rate-limit-threshold-interval-sec=60 \
  --ban-duration-sec=300

# IP allowlist for /rotate
gcloud compute security-policies rules create 900 \
  --security-policy=tang-edge-policy \
  --expression="request.path == '/rotate' && !inIpRange(origin.ip, 'YOUR_IP/32')" \
  --action=deny-403
```

### IAM

Use a dedicated service account with minimal permissions:

```bash
gcloud iam service-accounts create tang-edge-sa

gcloud projects add-iam-policy-binding YOUR_PROJECT \
  --member="serviceAccount:tang-edge-sa@YOUR_PROJECT.iam.gserviceaccount.com" \
  --role="roles/datastore.user"
```

## Key Management

```bash
# List keys (via gcloud firestore)
gcloud firestore documents list projects/YOUR_PROJECT/databases/(default)/documents/tang-keys

# Delete a key (full revocation)
gcloud firestore documents delete \
  projects/YOUR_PROJECT/databases/(default)/documents/tang-keys/<thp>.jwk
```
