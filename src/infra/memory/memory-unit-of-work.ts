import type { Repositories, UnitOfWork } from "~/domain/unit-of-work";

/** An in-memory repository whose whole state can be captured and put back. */
export interface Snapshottable {
  snapshot(): unknown;
  restore(snapshot: never): void;
}

/**
 * Snapshots every repository before the work and restores them all if it
 * throws. Repositories never mutate a snapshot, so taking one is cheap.
 */
export class MemoryUnitOfWork implements UnitOfWork {
  constructor(
    readonly repositories: Repositories,
    private readonly stores: readonly Snapshottable[],
  ) {}

  run<T>(work: (repositories: Repositories) => T): T {
    const snapshots = this.stores.map((store) => store.snapshot());
    try {
      const result = work(this.repositories);
      if (result instanceof Promise) throw new Error("Unit of work must be synchronous");
      return result;
    } catch (error) {
      this.stores.forEach((store, i) => (store.restore as (snapshot: unknown) => void)(snapshots[i]));
      throw error;
    }
  }
}
