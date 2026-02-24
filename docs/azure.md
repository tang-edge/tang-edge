# Azure Functions

## Deploy

```bash
npm i -g azure-functions-core-tools@4
func init --worker-runtime node --language typescript
func azure functionapp publish YOUR_FUNCTION_APP
```

## Configuration

`host.json` (already included in repo):

```json
{
  "version": "2.0",
  "extensionBundle": {
    "id": "Microsoft.Azure.Functions.ExtensionBundle",
    "version": "[4.*, 5.0.0)"
  }
}
```

## Environment Variables

Set in Azure Portal (Function App → Configuration → Application Settings):

| Variable | Description |
|----------|-------------|
| `AZURE_STORAGE_CONNECTION_STRING` | Azure Storage connection string (required) |
| `TANG_TABLE` | Table name (default: `tangkeys`) |
| `ROTATE_TOKEN` | Token for POST /rotate |

## Storage (Azure Table Storage)

1. Create a Storage Account:

```bash
az storage account create \
  --name tangedgestorage \
  --resource-group tang-edge-rg \
  --location westeurope \
  --sku Standard_LRS
```

2. Get the connection string:

```bash
az storage account show-connection-string \
  --name tangedgestorage \
  --resource-group tang-edge-rg
```

Table schema:

| Column | Type | Description |
|--------|------|-------------|
| `PartitionKey` | String | Fixed: `"tang"` |
| `RowKey` | String | Key name (e.g., `{thp}.jwk`) |
| `value` | String | JWK JSON string |

## Security Hardening

### Azure Front Door / WAF

```bash
# Create WAF policy
az network front-door waf-policy create \
  --name tangEdgeWaf \
  --resource-group tang-edge-rg \
  --mode Prevention

# Rate limit rule
az network front-door waf-policy rule create \
  --name RateLimit \
  --policy-name tangEdgeWaf \
  --resource-group tang-edge-rg \
  --rule-type RateLimitRule \
  --rate-limit-threshold 10 \
  --rate-limit-duration-in-minutes 1 \
  --action Block \
  --priority 100
```

### Managed Identity

Use managed identity instead of connection strings where possible:

```bash
az functionapp identity assign \
  --name tang-edge \
  --resource-group tang-edge-rg
```

## Key Management

```bash
# List keys
az storage entity query \
  --table-name tangkeys \
  --connection-string "YOUR_CONNECTION_STRING" \
  --filter "PartitionKey eq 'tang'"

# Delete a key (full revocation)
az storage entity delete \
  --table-name tangkeys \
  --connection-string "YOUR_CONNECTION_STRING" \
  --partition-key tang \
  --row-key "<thp>.jwk"
```
