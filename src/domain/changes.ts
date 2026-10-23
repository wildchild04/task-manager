/**
 * Numbers every committed write to the store, so open screens can tell that
 * something changed. In-process: there's one server and one database.
 */
export interface ChangeFeed {
  /** The number of the latest committed write; starts at 0 when the process starts. */
  readonly current: number;
  /** Called with the new number after each committed write. Returns an unsubscribe. */
  subscribe(listener: (seq: number) => void): () => void;
}

/**
 * A feed plus `committed()`, which advances it. Only the composition module
 * calls `committed()`, once per outermost write that didn't throw.
 */
export function createChangeFeed(): { feed: ChangeFeed; committed: () => number } {
  let current = 0;
  const listeners = new Set<(seq: number) => void>();
  const feed: ChangeFeed = {
    get current() {
      return current;
    },
    subscribe(listener) {
      // Wrapped, so the same function subscribed twice is two subscriptions.
      const entry = (seq: number) => listener(seq);
      listeners.add(entry);
      return () => listeners.delete(entry);
    },
  };
  function committed(): number {
    const seq = ++current;
    for (const listener of [...listeners]) {
      // A failing listener (a stream whose client went away) mustn't stop the others or the write.
      try {
        listener(seq);
      } catch (error) {
        console.error("Change listener failed", error);
      }
    }
    return seq;
  }
  return { feed, committed };
}
