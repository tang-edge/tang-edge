// SPDX-License-Identifier: GPL-3.0-only
// Copyright (c) tang-edge contributors

import { MemoryStorage } from "../../src/storage/adapters/memory";
import { runAdapterTests } from "./adapter-shared";

runAdapterTests("MemoryStorage", () => new MemoryStorage());
