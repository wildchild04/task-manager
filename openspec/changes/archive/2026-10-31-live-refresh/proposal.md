## Why

Screens only show what changed elsewhere after a navigation: an agent's comment, a task it moved, a page it created or a suggestion it made stay invisible until the page is opened again, and two tabs on the same page drift apart. Agents now write to the homelab all day through MCP, so the open tab is regularly out of date.

## What Changes

- **A change feed** in the domain: after every committed write (a block batch, or any unit of work), the store's change counter goes up by one and listeners are told the new number. It's in-process, created in the composition module like the repositories; there's one server process and one database, so it sees every write: the editor, forms, the agent API and MCP alike.
- **`GET /api/changes`**: a Server-Sent Events stream that sends `change` events (`{ seq }`) as writes happen, and a comment line every 25 seconds so idle connections stay open. It bypasses response compression so events aren't held back, and needs no change to Caddy (it flushes event streams as they come, under the existing `/task-manager*` block).
- **Open tabs refresh themselves**: the app shell subscribes once per tab and re-reads the screen's data (React Router revalidation, no full page reload) when another tab, a form elsewhere or an agent changes anything, a few changes in quick succession refreshing once. A tab ignores the changes of its own editor saves, which already return the change they made.
- **Never stale for long**: when the stream drops (a redeploy answers 502, a `caddy reload`, a sleeping laptop), the tab retries with a growing delay and refreshes once it's back; it also refreshes when the tab becomes visible again after being hidden.
- **The editor keeps unsaved work**: a page with unsaved edits isn't replaced (as today); with none, newer content appears in place, keeping the caret in its block when that block still exists.

## Capabilities

### New Capabilities
- `live-refresh`: the change feed, the event stream, and how open tabs refresh, reconnect and catch up.

### Modified Capabilities
- `block-editor`: "Saving edits": a change made elsewhere appears in an open editor without navigating, and the caret stays where it was.

## Non-goals

- Merging concurrent edits to the same page: with no unsaved edits the newer content replaces the editor's (as today); with unsaved edits the editor's saves win as before. The product is single-user.
- Telling tabs *what* changed, or refreshing only the affected screen: every foreign change refreshes the screen's data once; loaders are cheap on local SQLite. Scoped events can come later without changing the transport.
- WebSockets, multi-process deployments (Redis or similar to share the feed), and offline support.
- Showing who else is viewing a page, or live cursors.

## External dependencies

None: no new design-system components; no new packages (`EventSource` is the browser's own).

## Impact

- `src/domain/changes.ts` (new): the `ChangeFeed` port (current number, subscribe) and its in-process implementation; `src/composition.ts` wraps the unit of work and block writes so each committed write advances it, and adds `changes` to the services.
- `app/routes/api.changes.ts` (new) and `app/routes.ts`; `app/lib/changes.server.ts` (new) for the stream.
- `server.mjs`: compression skips `text/event-stream` responses.
- `app/routes/api.edits.ts` / `app/lib/page-edit.server.ts`: the edit answer includes the change number it made.
- `app/routes/shell.tsx` (or a hook it uses): the subscription, coalescing, reconnecting and refresh on visibility; `app/editor/page-editor.tsx`: ignoring its own changes, keeping the caret across a reset.
- Tests: the feed (unit, both repositories), the stream route, the editor reset; a Playwright check of a second tab and an agent write appearing without navigation, in Chromium and Firefox.
