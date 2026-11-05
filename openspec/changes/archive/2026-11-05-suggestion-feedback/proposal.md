## Why

A suggestion that is almost right can only be approved as it is or rejected. To get it fixed, the human rejects it and hopes the agent tries again, or edits the result after approving, and the agent never learns what was wrong. The exploration "Revising suggestions before approval" settled on sending feedback to the agent. The human asks for changes with a note. The agent finds the suggestion through MCP and revises the same suggestion. It works for block and action suggestions alike, and keeps the agent in the loop.

## What Changes

- **Request changes**: next to Approve and Reject, every pending suggestion (block or action, outdated too) offers **Request changes**. It opens a dialog for a note to the agent (at most 2,000 characters). The suggestion's state becomes **changes requested**. The human can still approve or reject it, and can add more feedback.
- **On screen**: a suggestion with changes requested shows a "Changes requested" status and the human's feedback ("You asked: …"). After the agent revises it, it shows "Revised", with the feedback it answered.
- **Not waiting for the human**: a suggestion with changes requested waits on its agent. It is not counted in the notification bell or "Waiting for review", and Approve all skips it. A revised suggestion is waiting for review again.
- **Agents revise in place**: `POST suggestion/:id/revise` (MCP `revise_suggestion`). Only the author can revise its own pending suggestion. A block suggestion gets new proposed blocks (`markdown`; not for a delete). A rename gets a new `title`, and a schedule suggestion a new `schedule`. Any suggestion can get a new `note`, the agent's reply. The ID, action, target or subject, and position stay. Revising checks the suggestion against the current target or subject again, so it is no longer outdated, and marks the feedback answered.
- **Agents find feedback**: `GET suggestions` (MCP `list_suggestions`) lists the calling agent's own open suggestions, filterable by `state` (`pending`, `outdated`, `changes_requested`). `GET suggestion/:id` gains the open `feedback`, the `note` and a `revision` number.
- Not in this change: the human editing proposed blocks directly, showing a diff between revisions, pushing feedback to agents (they poll), and editing or deleting feedback once sent.

## Capabilities

### New Capabilities
- `suggestion-feedback`: requesting changes on a suggestion, the changes requested state and feedback record, revising by the author, and how both show on the page and at the action bars.

### Modified Capabilities
- `agent-suggestions`: Approve all skips suggestions with changes requested.
- `agent-api`: the functions table gains `GET suggestions` and `POST suggestion/:id/revise`, and `GET suggestion/:id` gains `note`, `revision` and `feedback`. A new requirement covers revising and listing.
- `agent-mcp`: the tool list gains `list_suggestions` and `revise_suggestion`. `get_suggestion`'s description explains feedback.
- `app-shell`: the bell doesn't count suggestions with changes requested.
- `project-screens`: "Waiting for review" doesn't list them.

## Impact

- `db/migrations/010_suggestion_feedback.sql`: `suggestions` gains `revision` and `revised_at`, and a new `suggestion_feedback` table holds the human's notes.
- `src/domain/suggestions/`:
  - the types (a `changes_requested` state, feedback, revision)
  - the repository port, with its memory and SQLite implementations and contract tests
  - `SuggestionService`: `requestChanges`, `revise`, `listByAuthor`, plus Approve all and the views
- App:
  - `app/lib/suggestions.server.ts` and `app/routes/api.suggestions.ts` (a `request-changes` intent)
  - `SuggestionBox` in `app/blocks/block-view.tsx`, and `ActionSuggestionBar`
  - a new feedback dialog component
  - `app/lib/home.server.ts` (bell and dashboard)
- Agent API and MCP: `app/lib/agent/functions.server.ts`, `request.server.ts`, `mcp/tools.ts`, `mcp/README.md`.
- Tests: suggestion service and repository tests, `tests/app/agent-api.test.ts`, `tests/mcp.test.ts`, the home and bell tests, and a Playwright spec.

## External dependencies

None. The UI uses existing design-system components: `Dialog`, `TextField` (multiline), `ReviewContainer` (its `status`), `Alert` and `Button`.

## Non-goals

- Editing a suggestion's proposed blocks or payload by hand before approving it.
- Versions of a suggestion that can be compared, or a diff between revisions.
- Telling agents about feedback by push or notification. Agents check `list_suggestions`.
- Threads or replies on feedback beyond the agent's note, and editing or deleting feedback once sent.
- Changing a suggestion's action, target, position or subject when revising. For that, the agent withdraws it and suggests again.
