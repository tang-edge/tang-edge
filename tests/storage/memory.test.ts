import { MemoryStorage } from "../../src/storage/adapters/memory";
import { runAdapterTests } from "./adapter-shared";

runAdapterTests("MemoryStorage", () => new MemoryStorage());
