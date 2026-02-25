// SPDX-License-Identifier: GPL-3.0-only
// Copyright (c) tang-edge contributors

/**
 * Azure Functions entry point for tang-edge.
 *
 * Azure Table Storage schema:
 *   PartitionKey: "tang" (fixed)
 *   RowKey: key name (e.g., "{thp}.jwk")
 *   value: JWK JSON string
 *
 * Environment variables:
 *   AZURE_STORAGE_CONNECTION_STRING - Azure Storage connection string
 *   TANG_TABLE          - Table name (default: tangkeys)
 *   ROTATE_TOKEN        - token for POST /rotate endpoint
 */
import { app as azApp } from "@azure/functions";
import { azureHonoHandler } from "@marplex/hono-azurefunc-adapter";
import { app } from "../index";
import { AzureTableStorage } from "../storage/adapters/azure-tables";
import type { Env } from "../storage/types";

const connectionString = process.env.AZURE_STORAGE_CONNECTION_STRING;
if (!connectionString) {
  throw new Error("Missing required env: AZURE_STORAGE_CONNECTION_STRING");
}
const tableName = process.env.TANG_TABLE ?? "tangkeys";

const env: Env = {
  TANG_KEYS: new AzureTableStorage(connectionString, tableName),
  ROTATE_TOKEN: process.env.ROTATE_TOKEN,
};

azApp.http("tang", {
  methods: ["GET", "POST"],
  authLevel: "anonymous",
  route: "{*proxy}",
  handler: azureHonoHandler((req: Request) => app.fetch(req, env)),
});
