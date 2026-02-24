# AWS Lambda

## Deploy

### Option 1: AWS SAM

```yaml
# template.yaml
AWSTemplateFormatVersion: '2010-09-09'
Transform: AWS::Serverless-2016-10-31

Resources:
  TangEdgeFunction:
    Type: AWS::Serverless::Function
    Properties:
      Handler: src/platforms/aws-lambda.handler
      Runtime: nodejs20.x
      MemorySize: 128
      Timeout: 10
      Environment:
        Variables:
          TANG_TABLE: tang-keys
      Policies:
        - DynamoDBCrudPolicy:
            TableName: !Ref TangKeysTable
      Events:
        Api:
          Type: HttpApi

  TangKeysTable:
    Type: AWS::DynamoDB::Table
    Properties:
      TableName: tang-keys
      BillingMode: PAY_PER_REQUEST
      AttributeDefinitions:
        - AttributeName: pk
          AttributeType: S
      KeySchema:
        - AttributeName: pk
          KeyType: HASH
```

```bash
sam build
sam deploy --guided
```

### Option 2: SST

```typescript
// sst.config.ts
export default {
  config: () => ({ name: "tang-edge", region: "eu-central-1" }),
  stacks(app) {
    app.stack(({ stack }) => {
      const table = new Table(stack, "keys", {
        fields: { pk: "string" },
        primaryIndex: { partitionKey: "pk" },
      });
      new Function(stack, "tang", {
        handler: "src/platforms/aws-lambda.handler",
        bind: [table],
        environment: { TANG_TABLE: table.tableName },
        url: true,
      });
    });
  },
};
```

## Environment Variables

| Variable | Description |
|----------|-------------|
| `TANG_TABLE` | DynamoDB table name (default: `tang-keys`) |
| `AWS_REGION` | AWS region (default: `eu-central-1`) |
| `ROTATE_TOKEN` | Token for POST /rotate |

Set `ROTATE_TOKEN` via AWS Secrets Manager or Lambda environment variables (encrypted at rest).

## DynamoDB Table Schema

| Attribute | Type | Description |
|-----------|------|-------------|
| `pk` | String | Key name (e.g., `{thp}.jwk`) |
| `value` | String | JWK JSON string |

## Security Hardening

### API Gateway Throttling

```yaml
# In SAM template
Events:
  Api:
    Type: HttpApi
    Properties:
      ThrottleConfig:
        BurstLimit: 20
        RateLimit: 10
```

### WAF (AWS WAF v2)

```bash
# Create rate-based rule
aws wafv2 create-web-acl \
  --name tang-edge-waf \
  --scope REGIONAL \
  --default-action '{"Allow":{}}' \
  --rules '[{
    "Name": "RateLimit",
    "Priority": 1,
    "Action": {"Block": {}},
    "Statement": {
      "RateBasedStatement": {
        "Limit": 100,
        "AggregateKeyType": "IP"
      }
    },
    "VisibilityConfig": {
      "SampledRequestsEnabled": true,
      "CloudWatchMetricsEnabled": true,
      "MetricName": "RateLimit"
    }
  }]' \
  --visibility-config '{"SampledRequestsEnabled":true,"CloudWatchMetricsEnabled":true,"MetricName":"tang-edge"}'
```

### IAM (Least Privilege)

Lambda role should only have:

```json
{
  "Effect": "Allow",
  "Action": [
    "dynamodb:GetItem",
    "dynamodb:PutItem",
    "dynamodb:DeleteItem",
    "dynamodb:Scan"
  ],
  "Resource": "arn:aws:dynamodb:*:*:table/tang-keys"
}
```

## Key Management

```bash
# List keys
aws dynamodb scan --table-name tang-keys --projection-expression pk

# Delete a key (full revocation)
aws dynamodb delete-item --table-name tang-keys --key '{"pk":{"S":"<thp>.jwk"}}'
```
