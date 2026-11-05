## 1. Storage and domain

- [x] 1.1 `db/migrations/010_suggestion_feedback.sql`: `suggestions` gains `revision INTEGER NOT NULL DEFAULT 1` and `revised_at TEXT`; new table `suggestion_feedback` (`id`, `suggestion_id` → suggestions, `text`, `revision`, `created_at`) with an index on `suggestion_id`; a migration test on a database with existing suggestions (they read back at revision 1, no feedback)
- [x] 1.2 Types: `revision` and `revisedAt` on the suggestion record, a `SuggestionFeedback` type, and `"changes_requested"` in `SuggestionState`. Repository port: `addFeedback`, `listFeedback(suggestionId)` (oldest first), `listPendingByAuthor(author)`. Memory and SQLite implementations, with contract tests in `tests/contract/suggestion.contract.ts`
- [x] 1.3 `SuggestionService` views: state precedence (status, then changes requested, then outdated, then pending), with `outdated`, open `feedback` and `answered` on the view; `FEEDBACK_MAX = 2000`; tests
- [x] 1.4 `requestChanges(id, text)`: pending only (outdated allowed), trimmed text of 1 to 2,000 characters, recorded at the current revision; tests including resolved, empty, too long, and approve or reject after feedback
- [x] 1.5 `revise(...)`: author only, pending only, at least one field. Block insert or replace takes new blocks (old children deleted, new inserted, forbidden types refused); a delete takes none; replace and delete rebase on the current target (a missing target is refused). Actions: rename `title` (trimmed) and schedule `schedule` checked by `SuggestedActions.check`, rebased with `baseOf`. Any kind takes `note` (≤ 280, `""` clears). Revision + 1, `revisedAt`. Tests for each kind, outdated becoming approvable, forbidden and resolved, and nothing changed on refusal (memory and SQLite)
- [x] 1.6 `listByAuthor(author, state?)`; `approveAll` skips changes requested and returns `waiting`; tests

## 2. Screens

- [x] 2.1 `/api/suggestions`: a `request-changes` intent (`{ id, text }`) in `decideSuggestion`; the approve-all message adds "N waiting for changes"; tests
- [x] 2.2 `RequestChangesDialog` component (`Dialog`, multiline `TextField` "What should change?", Send disabled while empty, Cancel, refusal shown inline)
- [x] 2.3 `SuggestionBlockView` and `page-view.server.ts` gain `state`, `feedback` and `answered`. `SuggestionBox`: a Request changes button, the status chip (Changes requested, Outdated, Revised), and "You asked: …" with the note. The editor's `decide` handles the new intent; screen tests
- [x] 2.4 `ActionSuggestionItem` gains `state`, `feedback` and `answered`; `ActionSuggestionBar` gets Request changes, the dialog, and the status lines; tests
- [x] 2.5 `home.server.ts`: `review()` leaves out changes requested, for the bell and "Waiting for review"; tests in the home and bell tests, including the place coming back after a revision

## 3. Agent API and MCP

- [x] 3.1 `GET suggestions` (own, open, `state` filter, paged like `GET tasks`); `GET suggestion/:id` adds `revision`, `note`, and `feedback` while `changes_requested`
- [x] 3.2 `POST suggestion/:id/revise`: a strict body, fields allowed per action, Markdown via `blocksOf` with warnings, error codes as in the spec; returns `{ ok, revision }`; tests in `tests/app/agent-api.test.ts`
- [x] 3.3 `mcp/tools.ts`: `list_suggestions`, `revise_suggestion`, and descriptions as in the agent-mcp spec (`get_suggestion` mentions feedback); `mcp/README.md`; `tests/mcp.test.ts` (25 tools)

## 4. Check

- [x] 4.1 Typecheck, unit tests, and the Playwright suite. Add a Playwright spec: an agent suggests an insert and a rename through the API, the human requests changes on both from the screens, and the bell drops them. The agent lists and revises them through the API; the screens show "Revised", and the bell lists them again.
- [x] 4.2 Try it on the dev instance through `notion-tasks-dev` (restart the dev server; `/mcp` reconnect): request changes in the browser, then `list_suggestions`, `get_suggestion` and `revise_suggestion`, and approve the revision
