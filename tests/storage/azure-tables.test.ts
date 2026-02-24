import { mock, beforeEach } from "bun:test";
import { runAdapterTests } from "./adapter-shared";

const store = new Map<string, string>();

mock.module("@azure/data-tables", () => ({
  TableClient: {
    fromConnectionString: () => ({
      getEntity: async (_pk: string, key: string) => {
        if (!store.has(key)) {
          const err: any = new Error("Not found");
          err.statusCode = 404;
          throw err;
        }
        return { value: store.get(key) };
      },
      upsertEntity: async (entity: any) => {
        store.set(entity.rowKey, entity.value);
      },
      deleteEntity: async (_pk: string, key: string) => {
        if (!store.has(key)) {
          const err: any = new Error("Not found");
          err.statusCode = 404;
          throw err;
        }
        store.delete(key);
      },
      listEntities: (_opts?: any) => ({
        [Symbol.asyncIterator]: async function* () {
          for (const k of store.keys()) {
            yield { rowKey: k };
          }
        },
      }),
    }),
  },
}));

const { AzureTableStorage } = await import("../../src/storage/adapters/azure-tables");

beforeEach(() => store.clear());

runAdapterTests(
  "AzureTableStorage",
  () => new AzureTableStorage("DefaultEndpointsProtocol=https;AccountName=test"),
);
