import { readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { fileURLToPath } from "node:url";

import type Database from "better-sqlite3";

export const defaultMigrationsDir = fileURLToPath(new URL("../../../db/migrations", import.meta.url));

/**
 * Applies numbered `NNN_name.sql` migrations that have not run yet, in order,
 * each in its own transaction, recording them in `schema_migrations`.
 */
export function migrate(db: Database.Database, dir: string = defaultMigrationsDir): string[] {
  db.exec(`CREATE TABLE IF NOT EXISTS schema_migrations (
    name TEXT PRIMARY KEY,
    applied_at TEXT NOT NULL
  )`);

  const applied = new Set(
    db
      .prepare("SELECT name FROM schema_migrations")
      .pluck()
      .all() as string[],
  );
  const pending = readdirSync(dir)
    .filter((file) => /^\d+_.+\.sql$/.test(file) && !applied.has(file))
    .sort();

  const record = db.prepare("INSERT INTO schema_migrations (name, applied_at) VALUES (?, ?)");
  for (const file of pending) {
    db.transaction(() => {
      db.exec(readFileSync(join(dir, file), "utf8"));
      record.run(file, new Date().toISOString());
    })();
  }
  return pending;
}
