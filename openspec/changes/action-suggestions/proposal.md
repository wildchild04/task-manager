## Why

The decision on "What agents are allowed to do" sends the rest of what agents can't do yet through approval. Agents create things directly. Edits, deletions and ending transitions should be proposed for a human to approve, the same way block changes already are. Today agents can't rename or delete anything, can't change a chore's schedule, and can't create projects. But they can cancel work, tombstone ideas and end chore series with no review.

## What Changes

- **Action suggestions**: an agent can suggest:
  - renaming a project (its home page's title), a page or a task
  - deleting a project, a page or a task
  - changing a chore's schedule
  - an ending transition: cancel work, tombstone an exploration or update, or cancel a chore series

  The human approves or rejects it. Approving runs the same action the human's own control runs. An action suggestion is **outdated** when its subject changed since it was made, or is gone.
- **Shown at the control**: a pending action suggestion shows next to the control a human would use: the title, the delete button, the chore's schedule button, or the task's actions row. It appears as an "*agent* suggests …" bar with the agent's note and Approve and Reject buttons.
- **Bell and home dashboard**: places with action suggestions are listed in the notification bell and in "Waiting for review", together with block suggestions, and link to the place.
- **Agents create projects** directly: `POST projects`, and MCP `create_project`.
- **Agent API**: `POST suggest-action` and MCP `suggest_action`. `GET suggestion/:id` and `withdraw_suggestion` cover both kinds of suggestion.
- **Ending transitions removed from agents**: work `cancel`, exploration or update `tombstone`, and chore `cancel` with scope `series` are no longer agent transitions. They aren't listed in `GET task/:id`'s `transitions`, and are refused as `forbidden` like any change agents can't make. Agents suggest them instead. Their working flow stays direct: start, pause, complete and return work; promote; revive; complete a chore; cancel one chore occurrence.
- Not in this change: revising a suggestion before approval, per-agent permissions, and recording who created a task.

## Capabilities

### New Capabilities
- `action-suggestions`: suggestions of actions, not block changes: what can be suggested, its record and outdated state, approving and rejecting, and where the bars show.

### Modified Capabilities
- `agent-api`: permissions (ending transitions only through suggestions; creating projects), the functions table (`POST projects`, `POST suggest-action`, the subject in `GET suggestion/:id`).
- `agent-mcp`: the tool list gains `create_project` and `suggest_action`.
- `app-shell`: the notification bell counts and lists places with action suggestions.
- `project-screens`: "Waiting for review" includes action suggestions.

## Impact

- `db/migrations/007_action_suggestions.sql`: the `suggestions` table gains `subject_kind`, `subject_id` and `payload`, and its `action` check gains `rename`, `schedule` and `transition`. The table is rebuilt, because SQLite can't alter a CHECK.
- `src/domain/suggestions/`: the types become block and action suggestions; `SuggestionService` gains `suggestAction`, and approve, reject, withdraw and outdated checks for actions.
- App:
  - `app/lib/home.server.ts` (pending places, bell, dashboard)
  - the project home, page and task routes, with their loaders and actions
  - a new `ActionSuggestionBar` component
- Agent API and MCP: `app/lib/agent/functions.server.ts`, `request.server.ts`, `mcp/tools.ts`, `mcp/README.md`.
- Tests:
  - domain contract tests for suggestions
  - `tests/app/agent-api.test.ts`, `tests/mcp.test.ts`, the screen tests
  - a Playwright spec
