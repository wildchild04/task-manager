## Why

Finding something in the workspace means knowing where it lives: which project, which list, which library folder. Agents hand out IDs (such as an 8-character short ID) that can't be looked up anywhere in the app, since page routes need the full ID.

## What Changes

- The top bar gets a search box. As the user types, it lists matching workspace pages, library documents, tasks and project homes, each with where it lives, and choosing one opens it.
- It matches titles anywhere (ignoring case), and IDs by prefix: a page's, task's or project's ID, from 4 characters, ignoring case. A result found by ID shows the matched ID. ID matches come first (an exact ID before a prefix), then title matches, earliest match first; at most 20 results.
- New `GET /api/search?q=` returns `{ results: [{ id, title, place, href, matchedId? }] }`.

## Capabilities

### Modified Capabilities
- `app-shell`: a global search in the top bar.

## Non-goals

- Tags: the app has no tags yet.
- Searching page or task content, comments, diagnostics or steps.
- Matching IDs anywhere but at the start, or by fewer than 4 characters.
- A search results page, keyboard shortcut, or remembering recent searches.
- Changing the mention picker's search (`/api/pages`) or the agent API's page search.

## Cloudscape gaps

The design system Autosuggest is placed in the shell actions and uses server-side filtering. This app has no tickets, so ticket-ID search is outside this port.

## Impact

- `app/lib/page-search.server.ts` (`globalSearch`), new `app/routes/api.search.ts` and `app/components/global-search.tsx`, `app/routes.ts`, `app/routes/shell.tsx`.
- Unit tests in `tests/app/page-search.test.ts`; e2e in `tests/e2e/global-search.spec.ts`.
