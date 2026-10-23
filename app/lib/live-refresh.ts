import { useEffect, useRef } from "react";
import { useRevalidator } from "react-router";

import { withBase } from "./base-path";

/** Changes arriving this close together refresh once. */
const COALESCE_MS = 150;
/** Reconnect delays after the server answered an error; doubling up to the last. */
const RECONNECT_MS = { first: 1000, max: 30_000 };

/** `EventSource.CLOSED`, which isn't defined during the server render or in tests. */
const CLOSED = 2;

/** Change numbers this tab's editor saves produced: their events aren't refreshed for. */
const own = new Set<number>();

/** Records the change number of one of this tab's own saves (from the `/api/edits` answer). */
export function recordOwnChange(seq: number): void {
  own.add(seq);
}

/** The minimum of `EventSource` this needs, so tests can stand in for it. */
export type ChangeSource = Pick<EventSource, "readyState" | "close"> & {
  addEventListener(type: "hello" | "change" | "error", listener: (event: Event) => void): void;
};

export type LiveRefreshOptions = {
  /** Opens the change stream. */
  open: () => ChangeSource;
  /** Re-reads the screen's data; resolves once the new data is on screen. */
  refresh: () => Promise<void>;
  /** Whether the tab is hidden: refreshes wait until it's visible. */
  hidden: () => boolean;
};

/**
 * Follows the change stream and refreshes for every change this tab's editor
 * didn't make: a few at once refresh once, and a change during a refresh
 * refreshes once more after it. When the stream is lost it reconnects with a
 * growing delay, and refreshes if anything changed meanwhile (or the server
 * restarted). Returns the cleanup and what to call when the tab becomes visible.
 */
export function followChanges({ open, refresh, hidden }: LiveRefreshOptions): { visible: () => void; stop: () => void } {
  let source: ChangeSource | null = null;
  let lastSeen: number | undefined;
  /** Changes seen since the last refresh, checked against `own` when it's due (a save's answer can come after its event). */
  let unseen: number[] = [];
  let wanted = false;
  let refreshing = false;
  let timer: ReturnType<typeof setTimeout> | undefined;
  let reconnect: ReturnType<typeof setTimeout> | undefined;
  let delay = RECONNECT_MS.first;
  let stopped = false;

  const foreign = (seq: number) => !own.delete(seq);

  function schedule() {
    if (timer === undefined) timer = setTimeout(due, COALESCE_MS);
  }

  function due() {
    timer = undefined;
    if (unseen.filter(foreign).length > 0) wanted = true;
    unseen = [];
    void run();
  }

  async function run() {
    if (!wanted || refreshing || hidden() || stopped) return;
    wanted = false;
    refreshing = true;
    try {
      await refresh();
    } catch {
      // The next change or reconnect tries again.
    } finally {
      refreshing = false;
    }
    // Changes during the refresh asked for another.
    void run();
  }

  function connect() {
    const current = open();
    source = current;
    current.addEventListener("hello", (event) => {
      delay = RECONNECT_MS.first;
      const { seq } = JSON.parse((event as MessageEvent<string>).data) as { seq: number };
      if (lastSeen !== undefined && seq < lastSeen) {
        // The server restarted: its numbers start again, ours mean nothing now.
        own.clear();
        wanted = true;
      } else if (lastSeen !== undefined) {
        for (let n = lastSeen + 1; n <= seq; n++) if (foreign(n)) wanted = true;
      }
      lastSeen = seq;
      void run();
    });
    current.addEventListener("change", (event) => {
      const { seq } = JSON.parse((event as MessageEvent<string>).data) as { seq: number };
      lastSeen = Math.max(lastSeen ?? seq, seq);
      unseen.push(seq);
      schedule();
    });
    current.addEventListener("error", () => {
      // EventSource retries network errors itself, but gives up for good when the server answers an error (a 502 while it restarts).
      if (current.readyState !== CLOSED || stopped) return;
      current.close();
      reconnect = setTimeout(connect, delay);
      delay = Math.min(delay * 2, RECONNECT_MS.max);
    });
  }

  connect();
  return {
    visible: () => void run(),
    stop: () => {
      stopped = true;
      clearTimeout(timer);
      clearTimeout(reconnect);
      source?.close();
    },
  };
}

/**
 * Keeps the screen's data current: re-reads it (React Router revalidation, no
 * page reload) when another tab, a form elsewhere or an agent changes
 * anything. Used once, by the app shell.
 */
export function useLiveRefresh(): void {
  const revalidator = useRevalidator();
  const revalidate = useRef(revalidator.revalidate);
  revalidate.current = revalidator.revalidate;

  useEffect(() => {
    if (typeof EventSource === "undefined") return;
    const follower = followChanges({
      open: () => new EventSource(withBase("/api/changes")),
      refresh: () => revalidate.current(),
      hidden: () => document.visibilityState === "hidden",
    });
    const onVisibility = () => {
      if (document.visibilityState === "visible") follower.visible();
    };
    document.addEventListener("visibilitychange", onVisibility);
    return () => {
      document.removeEventListener("visibilitychange", onVisibility);
      follower.stop();
    };
  }, []);
}
