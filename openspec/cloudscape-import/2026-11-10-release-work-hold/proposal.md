## Why

A work task an agent starts is held by that agent while it is in progress, and other agents are refused (`claimed`). When the holding session is gone or stuck, the only way to free the task is to pause it, which also takes it out of In progress. The human needs to release the hold and let another agent take the task over.

## What Changes

- The work task page shows "Held by <agent>" while an agent holds it, with a **Release** button. Releasing drops the hold and keeps the task in progress. It is recorded in history ("Released the hold of <agent>").
- An agent may `start` an in-progress work task nobody holds: the task stays in progress and that agent now holds it, recorded in history ("Took over the task"). `get_task` lists `start` in `transitions` then.
- The home page's "In progress · <agent>" names the current holder, so it drops the agent once released.

## Capabilities

### Modified Capabilities
- `agent-api`: holds end on release; taking over an unheld in-progress task with `start`.
- `task-history`: hold released and hold taken events.
- `task-screen`: the hold and its Release button.

## Non-goals

- Agents releasing another agent's hold, or their own (they pause or return instead).
- Holds on tickets or experiments (they aren't held).
- Releasing automatically when a session ends.

## Cloudscape gaps

None: Box, Button (inline link) and Alert in the task header.

## Impact

- `src/domain/tasks/task.service.ts` (`holder`, `releaseHold`, `takeHold`), `src/domain/tasks/task-events.ts`; `app/lib/agent/functions.server.ts`; `app/lib/task-actions.server.ts`, `app/lib/task-overview.server.ts`, `app/lib/home.server.ts`, `app/components/task-hold.tsx`, `app/routes/task.tsx`; `mcp/tools.ts`, `mcp/README.md`. The `claimed` message drops ", who started it". No migration (event types are free text).
- Agent API, page and e2e tests. Agents need `just install-mcp` and a `/mcp` reconnect for the updated description.
