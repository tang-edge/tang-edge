// SPDX-License-Identifier: GPL-3.0-only
// Copyright (c) tang-edge contributors

import type { TangStorage, TangStorageListResult } from "../interface";
import { TableClient } from "@azure/data-tables";

const PARTITION_KEY = "tang";

export class AzureTableStorage implements TangStorage {
  private readonly client: TableClient;

  constructor(connectionString: string, tableName: string = "tangkeys") {
    this.client = TableClient.fromConnectionString(connectionString, tableName);
  }

  async get(key: string): Promise<string | null> {
    try {
      const entity = await this.client.getEntity<{ value: string }>(
        PARTITION_KEY,
        key,
      );
      return entity.value ?? null;
    } catch (e: unknown) {
      if (e instanceof Error && "statusCode" in e && (e as any).statusCode === 404) return null;
      throw e;
    }
  }

  async put(key: string, value: string): Promise<void> {
    await this.client.upsertEntity({
      partitionKey: PARTITION_KEY,
      rowKey: key,
      value,
    });
  }

  async delete(key: string): Promise<void> {
    try {
      await this.client.deleteEntity(PARTITION_KEY, key);
    } catch (e: unknown) {
      if (e instanceof Error && "statusCode" in e && (e as any).statusCode === 404) return;
      throw e;
    }
  }

  async list(): Promise<TangStorageListResult> {
    const keys: { name: string }[] = [];
    const entities = this.client.listEntities({
      queryOptions: {
        filter: `PartitionKey eq '${PARTITION_KEY}'`,
        select: ["rowKey"],
      },
    });
    for await (const entity of entities) {
      keys.push({ name: entity.rowKey! });
    }
    return { keys };
  }
}
