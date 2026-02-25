// SPDX-License-Identifier: GPL-3.0-only
// Copyright (c) tang-edge contributors

/**
 * AWS Lambda entry point for tang-edge.
 *
 * DynamoDB table schema:
 *   Partition key: pk (String)
 *   Attribute: value (String)
 *
 * Environment variables:
 *   TANG_TABLE     - DynamoDB table name (default: tang-keys)
 *   AWS_REGION     - AWS region (default: eu-central-1)
 *   ROTATE_TOKEN   - token for POST /rotate endpoint
 */
import { handle } from "hono/aws-lambda";
import { app } from "../index";
import { DynamoDBStorage } from "../storage/adapters/dynamodb";
import type { Env } from "../storage/types";

const table = process.env.TANG_TABLE ?? "tang-keys";
const region = process.env.AWS_REGION ?? "eu-central-1";

const env: Env = {
  TANG_KEYS: new DynamoDBStorage(table, region),
  ROTATE_TOKEN: process.env.ROTATE_TOKEN,
};

export const handler = handle(app, (req) => app.fetch(req, env));
