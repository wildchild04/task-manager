## Why

The MCP functions audit (task "MCP Functions audit") found the tools sound but their descriptions and spec drifted: the `agent-mcp` spec lists 17 of the 27 tools, `list_projects` describes its answer wrongly, `list_tasks` leaves out the exploration, update and chore states, and no tool says whether it's read-only, so clients ask before every read. A refusal reads "this is a exploration". Separately, an exploration's page offers "Start exploration…", which makes no sense there: an exploration is already the idea, and revive and promote are its ways forward.

## What Changes

- **Tool annotations**: every tool declares `readOnlyHint`; the 13 reads say `true`, the 14 writes say `false` with `destructiveHint` (true only for `update_step`, `update_diagnostic` and `withdraw_suggestion`, which overwrite or remove) and `idempotentHint`. All say `openWorldHint: false`.
- **Descriptions**: `list_projects` says it returns `{ projects: [...] }`; `list_tasks` lists exploration and update states (open, promoted, tombstoned) and chore states (todo, done, cancelled). README: `withdraw_suggestion` takes back pending or outdated suggestions; the table row for `read_project_description` is aligned.
- **Refusal wording**: "this is an exploration" (the article follows the kind).
- **Spec**: `agent-mcp` lists all 27 tools and the annotations.
- **No "Start exploration" on explorations**: an exploration's page no longer offers it, and the action refuses it.

## Capabilities

### Modified Capabilities
- `agent-mcp`: all 27 tools, with annotations.
- `task-screen`: explorations don't offer "Start exploration".

## Non-goals

- Agents suggesting state changes (and showing those suggestions): a separate change, after its design is agreed.
- New tools (history, listing suggestions, cursors on `search_pages` and `list_references`), `outputSchema`, timestamps on comments and entries.
- Hiding "Start exploration" on updates: an update can still spin off a new idea.

## Cloudscape gaps

None: the change removes a button.

## Impact

- `mcp/tools.ts`, `mcp/README.md`; `app/lib/agent/functions.server.ts` (refusal wording); `app/lib/task-overview.server.ts` and `app/lib/task-actions.server.ts` (Start exploration). Tests: `tests/mcp.test.ts`, `tests/app/task-components.test.tsx` or the overview tests.
