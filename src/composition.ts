import { mkdirSync } from "node:fs";
import { dirname } from "node:path";

import Database from "better-sqlite3";

import { BlockService } from "~/domain/blocks/block.service";
import type { ProtectionHooks } from "~/domain/blocks/validate";
import { MemoryBlockRepository } from "~/infra/memory/memory-block.repository";
import { migrate } from "~/infra/sqlite/migrate";
import { SqliteBlockRepository } from "~/infra/sqlite/sqlite-block.repository";

/** Protection hooks registered by owning domains. Empty until tasks, projects and comments exist. */
const hooks: ProtectionHooks = {};

export type AppServices = { blocks: BlockService; close(): void };

/** The application's services, backed by SQLite. The only place a concrete repository is chosen. */
export function createServices(dbPath = process.env.DATABASE_PATH ?? "data/app.sqlite"): AppServices {
  if (dbPath !== ":memory:") mkdirSync(dirname(dbPath), { recursive: true });
  const db = new Database(dbPath);
  db.pragma("journal_mode = WAL");
  migrate(db);
  return { blocks: new BlockService(new SqliteBlockRepository(db, hooks)), close: () => db.close() };
}

/** The same services backed by memory, for tests and spikes. */
export function createInMemoryServices(): AppServices {
  return { blocks: new BlockService(new MemoryBlockRepository(hooks)), close: () => {} };
}
