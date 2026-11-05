## Context

A suggestion is a `suggestions` record. A block suggestion also has a `suggestion` block on its page, holding the proposed blocks. An action suggestion has a subject and a JSON payload instead.

`SuggestionService` decides everything:
- what can be suggested;
- approve, reject, withdraw, reopen, and approve all or reject all;
- the reported state, where `outdated` is derived from `base` against the target or subject now.

A few parts read that state:
- the review UI: `SuggestionBox` for block suggestions, `ActionSuggestionBar` for actions, both posting to `/api/suggestions`;
- the bell and dashboard, through `listPending()`;
- the agent API, through `get_suggestion`.

Agents only poll. Every committed write already advances the change feed, so open tabs refresh themselves.

The exploration "Revising suggestions before approval" chose feedback to the agent over editing in place. Its finding of 2026-11-04 records the choices: the agent revises the same suggestion, discovery is by a state plus an MCP list, and nothing is pushed.

## Goals / Non-Goals

**Goals:**
- The human asks for changes on any open suggestion, block or action, with a short text.
- The agent finds that, reads it, and revises the same suggestion (same ID).
- Bell and dashboard count only what waits for the human.

**Non-Goals:** see the proposal. In short: no editing by hand, no diffs or versions, no push, no feedback threads.

## Decisions

### Revision numbers decide what feedback is open

`suggestions` gains:
- `revision INTEGER NOT NULL DEFAULT 1`
- `revised_at TEXT`

A new table `suggestion_feedback` has `id`, `suggestion_id`, `text`, `revision` and `created_at`, with an index on `suggestion_id`. Feedback is **open** when its `revision` equals the suggestion's. Revising increments the revision, so all earlier feedback stops being open at once. Nothing is updated or flagged, and the history stays.

- *Alternative: a `changes_requested` status.* Rejected. Every "pending" check would have to learn a second open status: `listPending`, `pending()`, `idsInOrder`, the SQLite index and CHECK, and the bell. Changes requested is really "pending, plus a note from the human", which the derived state expresses better, just as `outdated` is derived.
- *Alternative: feedback as comment records (`kind: "feedback"`).* Rejected. Comments belong to a task (`taskId`), but suggestions also live on workspace pages and library documents. Comment bodies are block trees, more than a short instruction needs. Plain text keeps the dialog a `TextField`, and `get_suggestion` stays lean.

Migration `010_suggestion_feedback.sql` uses `ALTER TABLE … ADD COLUMN`; no table rebuild is needed. Existing rows get revision 1 and no feedback.

### The state is derived, and changes requested comes first

`SuggestionState` gains `"changes_requested"`. The view computes it as follows:
- not pending: the status;
- open feedback: `changes_requested`;
- outdated: `outdated`;
- otherwise: `pending`.

The view also carries:
- `outdated: boolean`, so the UI and Approve still know;
- `feedback`: the open entries;
- `answered`: the last feedback before the current revision, for the "Revised · You asked: …" display. Only when the current revision is above 1 and nothing is open.

`approveWithin` already checks `isOutdated` directly, so precedence doesn't loosen the outdated rule.

### `requestChanges` and `revise` on SuggestionService

- **`requestChanges(id, text)`:** requires a pending suggestion. A block suggestion must still be on its page, as `pending()` already checks. The text is trimmed, 1 to 2,000 characters (`FEEDBACK_MAX`). It inserts a feedback row at the current revision. Only humans reach it: it's called from `/api/suggestions`, never from the agent API.
- **`revise({ id, author, blocks?, title?, schedule?, note? })`**, inside one unit of work:
  - It requires a pending suggestion by `author`. Anything else is `forbidden` or `resolved`, as in `withdraw`.
  - At least one field must be given.
  - **Block insert or replace with `blocks`:** delete the suggestion block's children and insert the new ones under it (`insertOps(id, null, blocks)`, with the same forbidden types). For a replace, `base` is taken again from the current target, as in `suggest`. A replace whose target is gone can't be revised (`validation`): there's nothing to rebase on, so the agent withdraws it.
  - **Block delete:** only `note`. `base` is taken again from the current subtree, so revising an outdated delete confirms it against the page as it is now.
  - **Action:** `title` only for rename (trimmed), `schedule` only for schedule. The new payload goes through `SuggestedActions.check`, as in `suggestAction`, and `base` comes from `SuggestedActions.baseOf` now. `note` alone is allowed for any action, and it also rebases. A subject that no longer exists is `not_found`.
  - Then `revision + 1`, `revised_at = now`, and `note` replaced when given (`""` clears it).
- **`listByAuthor(author, state?)`:** open suggestions (still on their page, or with a subject that still exists, as `listPending` filters), viewed, and optionally filtered by reported state.

Rebasing on any revision is deliberate. The agent revising has seen the feedback and, ideally, the current page (`read_page` shows the suggestion and its target). Leaving it outdated would make every revision after an edit unapprovable.

### Repository port

`SuggestionRepository` gains:
- `addFeedback(feedback)` and `listFeedback(suggestionId)`, oldest first;
- `listPendingByAuthor(author)`.

`update` already replaces the whole record, so revision and revised_at go through it. The memory and SQLite implementations are checked by `tests/contract/suggestion.contract.ts`, as for the other repositories.

### Review queues filter on state

`home.server.ts`'s `review()` drops suggestions whose state is `changes_requested`. `listPending()` keeps returning all open suggestions, because the page still shows them. `approveAll` skips both outdated and changes requested, and returns `{ approved, outdated, waiting }`. `decideSuggestion` adds "N waiting for changes" to its message when there are any.

### UI: one dialog, two hosts

A new `RequestChangesDialog` (`app/components/request-changes-dialog.tsx`) uses the design system's `Dialog`, a multiline `TextField` labelled "What should change?", and Send and Cancel. It posts `{ intent: "request-changes", id, text }` to `/api/suggestions`. It shows refusals inside the dialog and calls `onSent` on success.

- **`SuggestionBox`:** `SuggestionsContext.decide` gains the intent `"request-changes"`. The editor's handler already posts to `/api/suggestions` and reloads. Status chip:
  - `changes_requested`: "Changes requested", tone `warning`;
  - else outdated: "Outdated", tone `error`;
  - else answered: "Revised", tone `default`.

  The `note` slot combines the agent's note with "You asked: …".
- **`ActionSuggestionBar`:** a third button and the same dialog. `ActionSuggestionItem` gains `state`, `feedback` (latest open text) and `answered`. The title keeps "<agent> suggests …"; the status line goes in the body.

The page's view model (`SuggestionBlockView` in `app/blocks/view-model.ts`, built in `app/lib/page-view.server.ts`) gains `state`, `feedback` and `answered` the same way.

### Agent API and MCP

- **`GET suggestions`:** `{ state?, limit?, cursor? }` gives `{ suggestions: [{ id, action, status, place, subject? }], more, cursor? }`. It pages with the same offset cursor helper as `GET tasks`. Only the caller's own suggestions are listed.
- **`GET suggestion/:id`:** adds `revision`, `note?`, and `feedback?: [{ text, at }]` (only when `changes_requested`).
- **`POST suggestion/:id/revise`:** a strict zod body `{ markdown?, title?, schedule?, note? }`. Markdown goes through `blocksOf` (warnings returned as for `suggest`). Fields not allowed for the action are refused before calling the service: `markdown` for insert or replace, `title` for rename, `schedule` for schedule. It returns `{ ok: true, revision }`.
- **MCP:** `list_suggestions` and `revise_suggestion`. `get_suggestion`'s description mentions `changes_requested` and `feedback`, and `withdraw_suggestion`'s stays. The README lists the tools.

## Risks / Trade-offs

- [An agent never polls, so feedback waits forever and the suggestion disappears from the bell] → The suggestion stays visible on its page with "Changes requested", and the human can still approve or reject it. Pushing to agents is a separate exploration (Notifications for agents).
- [Rebasing on revise can hide an edit the human made to the target after asking for changes] → The revision is shown again for review, and the "Removed" part shows the target as it is now, so the human sees exactly what would go.
- [Plain-text feedback can't hold a table or code example] → Acceptable for short instructions. The human can put longer material on the page or in a comment and refer to it.
- [Approve all now skips more] → Its message names how many were skipped and why.

## Migration Plan

Migration 010 runs on start, as the others do. It only adds columns and a table, so the deploy order doesn't matter: older code ignores the new columns. To roll back, deploy the previous build; the extra columns and table are unused.

## Open Questions

None.
