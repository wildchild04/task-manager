## Why

An exploration's results have nowhere to go. Comments are deliberately not allowed on explorations, since an exploration is a document itself, and agents can't edit an exploration's description, so an agent that settles a question can't record what it found. A human can only rewrite the description, which loses who concluded what and when. Explorations need a record of their results, kept separate from the question they ask.

## What Changes

- **Findings on explorations**: a finding is a dated record by an author (you or an agent) with a block body, like a comment. An exploration's findings are listed oldest first, so they read as the story of the exploration. Comments stay off explorations, and updates get neither.
- **A Findings tab** on the exploration's page, between Description and Lineage, with a count, an editor to add a finding, editing in place, deleting after a confirmation, and links at `#finding-<id>`.
- **Agents add findings directly**, with no approval, to an exploration in any state, even though agents otherwise change only work tasks. An agent can edit and delete only its own findings.
- **Agent API and MCP**: `GET task/:id/findings`, `POST task/:id/finding`, `POST finding/:id` (replace its content) and `POST finding/:id/delete`, exposed as the MCP tools `list_findings`, `add_finding`, `edit_finding` and `delete_finding`. `GET task/:id` counts an exploration's findings.
- **Promotion leaves findings where they are**: the new work's lineage already links back to the exploration. Nothing is copied.
- Deleting an exploration, or the project it's in, deletes its findings. Open tabs pick up findings through live refresh like any other write.

## Capabilities

### New Capabilities
- `exploration-findings`: the finding record, which tasks have findings, editing and deleting them, and their life with the exploration (promotion, deletion).

### Modified Capabilities
- `task-screen`: exploration pages get a Findings tab; "Explorations have no comments" stays, and explorations now show findings instead.
- `agent-api`: the permissions allow adding, editing and deleting your own findings on explorations; four new functions; `GET task/:id` counts findings.
- `agent-mcp`: the four new tools.

## Non-goals

- Findings on updates, work or chores. Work and chores have comments, and updates can be added later if they turn out to need findings.
- Copying findings into the work when an exploration is promoted, or choosing which ones to carry.
- Finding types (decision, question, result), resolving findings, or replies.
- Starting an exploration from a finding, or referencing a finding from another task.
- Agents suggesting findings for approval. Findings are additive and dated, so they don't need it.
- Showing findings on the home dashboard or in the notification bell.

## External dependencies

None. The Findings tab reuses the comment list, the comment editor and the confirmation dialog already built on design-system components.

## Impact

- `db/migrations/006_findings.sql` (new): a `kind` column on `comments` (`comment` or `finding`). Findings share the comments table, their block bodies and their protection.
- `src/domain/comments/`: a `kind` on the record; the service adds, lists, edits and deletes per kind, and checks which task kinds take which; the repositories list per kind.
- `src/infra/sqlite` and `src/infra/memory` comment repositories.
- `app/lib/task-overview.server.ts`, `app/lib/task-actions.server.ts`, `app/routes/task.tsx`, `app/components/task-comments.tsx` (generalized for findings).
- `app/lib/agent/functions.server.ts`, the agent API routes, `mcp/tools.ts`, `mcp/README.md`.
- Tests: the service per kind, both repositories, the task screen, the agent API and the MCP tools.
