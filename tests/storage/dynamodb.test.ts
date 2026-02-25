// SPDX-License-Identifier: GPL-3.0-only
// Copyright (c) tang-edge contributors

import { mock, beforeEach } from "bun:test";
import { runAdapterTests } from "./adapter-shared";

const store = new Map<string, string>();

mock.module("@aws-sdk/client-dynamodb", () => {
  class GetItemCommand {
    input: any;
    constructor(input: any) { this.input = input; }
  }
  class PutItemCommand {
    input: any;
    constructor(input: any) { this.input = input; }
  }
  class DeleteItemCommand {
    input: any;
    constructor(input: any) { this.input = input; }
  }
  class ScanCommand {
    input: any;
    constructor(input: any) { this.input = input; }
  }

  class DynamoDBClient {
    async send(cmd: any) {
      if (cmd instanceof GetItemCommand) {
        const key = cmd.input.Key.pk.S;
        if (!store.has(key)) return { Item: undefined };
        return { Item: { pk: { S: key }, value: { S: store.get(key) } } };
      }
      if (cmd instanceof PutItemCommand) {
        const key = cmd.input.Item.pk.S;
        const value = cmd.input.Item.value.S;
        store.set(key, value);
        return {};
      }
      if (cmd instanceof DeleteItemCommand) {
        const key = cmd.input.Key.pk.S;
        store.delete(key);
        return {};
      }
      if (cmd instanceof ScanCommand) {
        return {
          Items: Array.from(store.keys()).map((k) => ({ pk: { S: k } })),
        };
      }
    }
  }

  return { DynamoDBClient, GetItemCommand, PutItemCommand, DeleteItemCommand, ScanCommand };
});

const { DynamoDBStorage } = await import("../../src/storage/adapters/dynamodb");

beforeEach(() => store.clear());

runAdapterTests("DynamoDBStorage", () => new DynamoDBStorage("tang-keys", "us-east-1"));
