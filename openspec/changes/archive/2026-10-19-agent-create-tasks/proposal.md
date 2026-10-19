## Why

Agents can read the workspace and work tasks, but can't add to it: a planning agent can't turn a discussion into explorations, work and chores, so a human types every task in. The first project to need this is the task manager's own backlog on the homelab.

## What Changes

- `POST /api/agent/tasks` creates a task of any kind in an existing project, with an optional Markdown description; chores take urgency and a schedule, updates the done work they iterate on.
- The MCP server gains `create_task`.

## Capabilities

### Modified Capabilities
- `agent-api`: agents may create tasks; a new function.
- `agent-mcp`: the `create_task` tool.

## Non-goals

- Creating, renaming or deleting projects and pages, editing other kinds' descriptions, or cancelling: still human-only, pending the exploration on what agents may do.
- Recording who created a task (history records transitions; creation has no actor yet). The description can say so.

## Impact

- `app/lib/agent/functions.server.ts` (create, sharing the description append), `request.server.ts` (route); `mcp/tools.ts`, `mcp/README.md`; tests.
