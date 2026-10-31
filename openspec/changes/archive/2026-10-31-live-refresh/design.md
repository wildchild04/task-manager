## Context

One Node process serves everything: the React Router app (pages, loaders, actions, `/api/edits`), the agent API that the MCP server calls, and uploads. It holds one SQLite connection. Writes go through two doors, both chosen in `src/composition.ts`: `BlockService.apply` (one block batch in its own transaction; the editor's saves) and `UnitOfWork.run` (everything else: tasks, comments, suggestions, projects, chores; repositories inside it run as savepoints). Loaders don't write.

Screens read their data in loaders and re-read it with React Router's revalidation. The page editor already takes newer content on its own when the page's `version` changed and it has no unsaved edits (`page-editor.tsx`), and records the version each of its saves produced so its own saves don't look like outside changes. What's missing is a trigger: nothing re-reads a screen unless the user navigates or the editor's save needs it.

In production, Caddy proxies `/task-manager*` to the app (HTTP/2 to browsers, both over the LAN and the Tailscale MagicDNS name); `server.mjs` compresses every response.

## Goals / Non-Goals

**Goals:**
- An open tab shows writes made anywhere (another tab, a form, an agent) within about a second, without a full page reload.
- No polling while nothing changes; nothing to configure in Caddy.
- Recover by itself from dropped connections and redeploys.
- Keep unsaved editor work; don't move the caret on a refresh.

**Non-Goals:** see the proposal (merging, scoped events, WebSockets, multi-process, presence).

## Decisions

### 1. A change feed in the domain, advanced by the composition module

```ts
// src/domain/changes.ts
export interface ChangeFeed {
  /** The number of the latest committed write; starts at 0 when the process starts. */
  readonly current: number;
  /** Called with the new number after each committed write. Returns an unsubscribe. */
  subscribe(listener: (seq: number) => void): () => void;
}
```

`createChangeFeed()` returns the feed plus a `committed()` function for the composition module only. The composition module wraps the two write doors: `UnitOfWork.run` and `BlockService.apply`. When the outermost call returns without throwing (a depth counter, so a block batch inside a unit of work counts once, after the commit), it calls `committed()`, which increments `current` and notifies listeners synchronously. A write that throws, and so commits nothing, changes nothing.

Both the SQLite and in-memory services get it, so tests see the same behaviour. Domain services don't know about it.

*Alternatives:* emitting from each route or action (scattered, and easy to forget for a new route); SQLite's `PRAGMA data_version` (doesn't see the connection's own writes); hooks in the repositories (they run inside transactions that may still roll back).

### 2. Events say "something changed", numbered

An event is `{ seq }`, with no scope. Every foreign change makes a tab re-read its screen once. This is simple and always correct: the shell (sidebar, bell) and the screen are both covered, and loaders on local SQLite take milliseconds. Scoping (only the page on screen) can be added later by adding fields to the event; the transport and the client's coalescing stay the same.

### 3. The stream: `GET /api/changes`

`app/lib/changes.server.ts` builds a `Response` whose body is a `ReadableStream`:
- headers: `Content-Type: text/event-stream`, `Cache-Control: no-cache, no-transform`, `Connection: keep-alive`, `X-Accel-Buffering: no`;
- first, `retry: 3000` and an `event: hello` with the current `seq`, so a tab knows where it stands;
- then `event: change` / `data: {"seq":N}` for each committed write, from a feed subscription;
- a `: ping` comment line every 25 seconds;
- on `request.signal` abort (the tab closed, or the proxy dropped it), it unsubscribes and clears the timer.

`app/routes/api.changes.ts` is a resource route calling it. React Router streams a `Response` body through `@react-router/express` as it's produced, and Vite's dev server does the same.

**Compression:** `compression()` in `server.mjs` gets a `filter` that skips `text/event-stream` (otherwise gzip holds events back); `no-transform` tells any other proxy the same. **Caddy:** `reverse_proxy` flushes `text/event-stream` responses immediately and has no response timeout by default, so the existing `handle /task-manager*` block needs nothing. Over HTTP/2 all tabs share one browser connection, so the per-host connection limit of HTTP/1.1 doesn't apply.

### 4. The client: one subscription per tab, in the shell

A `useLiveRefresh()` hook in `app/lib/live-refresh.ts`, used once by `routes/shell.tsx` (every screen is inside the shell):

- **Subscribe:** `new EventSource(withBase("/api/changes"))`.
- **Own changes:** a module-level set of `seq` numbers this tab produced. The editor's save answer (`/api/edits`) gains `seq` (the feed's `current` right after the write; the write is synchronous, so that number is exactly the save's), and the editor adds it to the set. A `change` whose `seq` is in the set is skipped (and removed). Changes from this tab's forms aren't marked: their action already revalidates, and the extra refresh does no harm.
- **Coalesce:** a foreign change schedules a refresh 150 ms later; more changes before it fire join it. If a revalidation is already running, one more follows when it ends.
- **Gaps:** on `hello`, if the stream's `seq` is ahead of the last one seen (changes happened while disconnected) or the process restarted (`seq` lower than the last seen), refresh.
- **Reconnect:** `EventSource` retries by itself after a network error, but stops for good when the server answers an error status (Caddy's 502 while the container restarts). On `error` with `readyState === CLOSED`, the hook reopens after 1, 2, 4… up to 30 seconds, and the `hello` that follows triggers the catch-up refresh.
- **Visibility:** on `visibilitychange` to visible, refresh if any change arrived while hidden; and while hidden, the hook keeps the connection but defers refreshes until visible (a hidden tab doesn't need to re-render).
- During server rendering the hook does nothing (`EventSource` only in an effect).

### 5. The editor across a refresh

The rule stays: with unsaved edits (`queue.dirty`) the newer content is ignored, and it's taken once the edits are saved and the page re-read; without, `editor.reset` replaces the content. Two changes:
- **Caret:** `reset` already keeps the selection when its block still exists. The page editor now also writes the DOM selection back after a reset when the editor has focus, clamping the offset to the block's new length, so the caret doesn't jump to the start or out of the editor.
- **Undo:** a reset still clears the undo history (undo can't step back across someone else's change). This is noted in the spec.

A save racing an outside change is handled as today: the server applies batches in order; the editor's answer carries its own `version`, and the outside change's refresh brings the combined result once nothing is pending.

## Risks / Trade-offs

- [A refresh lands while typing] → Only replaces content when nothing is unsaved, which is just after a save; the caret is kept. Agents rarely write to the page being typed in (they comment and suggest); when they do, the newer content wins as today.
- [Every foreign change re-reads the screen] → Coalesced, and loaders are local SQLite reads; scoped events are a later addition if it ever shows.
- [Compression or another proxy buffering the stream] → The compression filter, `no-transform`, `X-Accel-Buffering: no`, and a Playwright check that events arrive through the production server's middleware (the dev server for the suite; a manual `curl -N` through Caddy after deploy).
- [Many tabs] → One idle connection each, a closure and a timer on the server; negligible for one user.
- [Feed only in memory] → A restart resets `seq`; the client treats a lower `seq` on `hello` as a restart and refreshes.

## Migration Plan

Deploy as usual (`just docker-redeploy`). Tabs open before the deploy have no subscription and keep working as before until reloaded. Rollback: redeploy the previous image; the client simply never connects. After deploying, check `curl -N https://192.168.100.101/task-manager/api/changes` prints `event: hello` at once and a change event when something is edited.

## Open Questions

None.
