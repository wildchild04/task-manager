## 1. Change feed

- [x] 1.1 `src/domain/changes.ts`: the `ChangeFeed` port (`current`, `subscribe`) and `createChangeFeed()` returning it with `committed()`; tests (numbers, unsubscribe, a throwing listener doesn't stop others)
- [x] 1.2 `src/composition.ts`: wrap `UnitOfWork.run` and `BlockService.apply` so the outermost successful call advances the feed once; `changes` in the services; tests for both SQLite and in-memory (a block batch, a unit of work containing a block batch counts once, a rejected batch doesn't count, an agent comment counts)

## 2. Event stream

- [x] 2.1 `app/lib/changes.server.ts` and the `GET /api/changes` route: headers, `retry`, `hello` with the current number, `change` events, the 25-second ping, cleanup on abort; tests reading the stream from the route module
- [x] 2.2 `server.mjs`: compression skips `text/event-stream`; check with a production build that `hello` arrives at once through it
- [x] 2.3 `/api/edits` answers include `seq`, the change number of the save

## 3. Refreshing tabs

- [x] 3.1 `app/lib/live-refresh.ts`: `useLiveRefresh()` (subscribe, own-change set, 150 ms coalescing, one more after a running revalidation, catch-up on `hello`, reconnect with backoff up to 30 s after `CLOSED`, defer while hidden); used once in `routes/shell.tsx`; the page editor records its saves' `seq`
- [x] 3.2 Editor: after a reset with focus in the editor, put the DOM caret back in its block, clamped to the block's length; test the reset keeping the selection

## 4. Check

- [x] 4.1 Playwright in Chromium and Firefox: a second tab sees a paragraph added in the first; an agent comment (agent API) appears on an open task and in the bell; the caret stays in its paragraph when an agent appends to the open description; unsaved edits survive an outside change; the tab's own typing triggers no loader re-reads; typecheck, unit tests and the whole suite
- [x] 4.2 Note the post-deploy check (`curl -N …/api/changes` through Caddy) in the README's proxy section
