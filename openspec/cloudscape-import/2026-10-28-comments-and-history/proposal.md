## Why

Agents could comment only on work, tickets and experiments, and explorations and updates took no comments at all, so an agent asked to look into an idea had nowhere to say what it found. And a task's history showed only transitions, step changes and incorrect marks: comments, edits, references, urgency and schedule changes, and suggestions left no trace, and agents couldn't read the history at all.

## What Changes

- **Comments on every task**: explorations and updates take comments like the other kinds, with a Comments tab; agents comment on any task (work another agent holds stays its own).
- **Everything goes in the history**: a new task event record, written in the same step as each change, with who made it: created, renamed, description edited, comments and diagnostic entries added, edited and deleted, references, urgency, schedule, steps added and removed, description suggestions and suggested transitions and their outcomes. Repeated edits within 10 minutes are one event. Tasks made before this show "Created" at their creation time.
- **Agents read it**: `GET task/:id/history` and the `list_history` tool (29 tools), paged, newest first.

## Capabilities

### New Capabilities
- `task-history`: recorded task events, and agents reading the history.

### Modified Capabilities
- `task-comments`: every kind takes comments.
- `task-screen`: comments and their tab on explorations and updates; the history lists every event.
- `agent-api`: comments on any task; the history function.
- `agent-mcp`: `list_history`, read-only.

## Non-goals

- Agents appending to explorations', updates' or chores' descriptions (they suggest instead).
- History for pages and projects; a diff of what an edit changed.
- Filtering the history on the page.

## Cloudscape gaps

None: the history and comments use the existing list and comment components.

## Impact

- New: `src/domain/tasks/task-events.ts`, `db/migrations/012_task_events.sql`, SQLite and memory repositories.
- Recording in `comment.service.ts`, `diagnostic.service.ts`, `task.service.ts` (create, references, `recordEvent`), `chore.service.ts`, `step.service.ts`, `suggestion.service.ts`, `state-suggestion.ts`; `app/lib/page-edit.server.ts` (title and description edits).
- `app/lib/task-overview.server.ts` (history entries and labels, comments on every kind), `app/lib/agent/*`, `mcp/tools.ts`, `mcp/README.md`.
- Tests: `tests/app/task-history.test.ts`, updated comment, history and MCP tests.
