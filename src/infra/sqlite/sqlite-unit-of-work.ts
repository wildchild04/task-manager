import type Database from "better-sqlite3";

import type { Repositories, UnitOfWork } from "~/domain/unit-of-work";

/**
 * One better-sqlite3 transaction around the work. Repository writes inside it
 * (such as a block batch) nest as savepoints. better-sqlite3 rejects work that
 * returns a promise, so async work can't silently escape the transaction.
 */
export class SqliteUnitOfWork implements UnitOfWork {
  constructor(
    private readonly db: Database.Database,
    readonly repositories: Repositories,
  ) {}

  run<T>(work: (repositories: Repositories) => T): T {
    return this.db.transaction(() => work(this.repositories))();
  }
}
