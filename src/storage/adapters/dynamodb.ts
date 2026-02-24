import type { TangStorage, TangStorageListResult } from "../interface";
import {
  DynamoDBClient,
  GetItemCommand,
  PutItemCommand,
  DeleteItemCommand,
  ScanCommand,
} from "@aws-sdk/client-dynamodb";

export class DynamoDBStorage implements TangStorage {
  private readonly client: DynamoDBClient;
  private readonly table: string;

  constructor(table: string, region?: string) {
    this.client = new DynamoDBClient({ region });
    this.table = table;
  }

  async get(key: string): Promise<string | null> {
    const res = await this.client.send(
      new GetItemCommand({
        TableName: this.table,
        Key: { pk: { S: key } },
      }),
    );
    return res.Item?.value?.S ?? null;
  }

  async put(key: string, value: string): Promise<void> {
    await this.client.send(
      new PutItemCommand({
        TableName: this.table,
        Item: { pk: { S: key }, value: { S: value } },
      }),
    );
  }

  async delete(key: string): Promise<void> {
    await this.client.send(
      new DeleteItemCommand({
        TableName: this.table,
        Key: { pk: { S: key } },
      }),
    );
  }

  async list(): Promise<TangStorageListResult> {
    const keys: { name: string }[] = [];
    let lastKey: Record<string, any> | undefined;
    do {
      const res = await this.client.send(
        new ScanCommand({
          TableName: this.table,
          ProjectionExpression: "pk",
          ExclusiveStartKey: lastKey,
        }),
      );
      for (const item of res.Items ?? []) {
        if (item.pk?.S) keys.push({ name: item.pk.S });
      }
      lastKey = res.LastEvaluatedKey;
    } while (lastKey);
    return { keys };
  }
}
