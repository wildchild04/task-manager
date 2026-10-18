## Context

Domain services (`TaskService`, `CommentService`, `BlockService`, `ProjectService`) are synchronous and accept an `Actor`. Resource routes (`/api/edits`, `/api/pages`) already serve JSON. Block content is a tree of typed blocks with rich-text spans, marks and mentions (a task mention points at the task's description page).

## Decisions

### 1. The API lives in the app; the MCP server is a client
`/api/agent/*` are resource routes, one module per function, all delegating to `app/lib/agent/*.server.ts`. The MCP server only maps tools to HTTP calls, so rules, permissions and data shapes live in one place and can be tested without MCP. The two ship from one repo and evolve together: the server lives in `mcp/` but uses the root package (one install, one test run; `npm run mcp` starts it).

### 2. One request pipeline
`agentRequest(request, handler)` checks the token (constant-time comparison) and the name, builds the actor, parses query/body with zod per function, resolves ID prefixes, runs the handler, and maps errors: `TaskError` codes → `invalid_transition` (409), `validation` (422), `not_found` (404); permission and claim checks → 403 / 409; unknown → 500 without details.

### 3. ID prefixes
Responses shorten IDs to 8 characters. Requests resolve an ID by exact match, else by prefix (≥ 6 characters) among the right kind of item (tasks in the projects, comments of the task, pages); more than one match → 409 `ambiguous`. With a single user's data, collisions at 8 hex characters are rare; the 409 makes them safe.

### 4. Caps and cursors
Lists sort deterministically (tasks by `updatedAt` desc then id; comments by `createdAt` desc then id) and page with a cursor that is the last item's short ID (8 characters, cheaper than an opaque token; an unknown cursor is refused so the agent lists again). Texts are cut at `maxChars` on a character boundary (never inside a surrogate pair) and report `offset` for the next read; `offset` beyond the end returns `""` with `more: false`.

### 5. Markdown conversion in the domain
`src/domain/blocks/markdown.ts` holds `toMarkdown(tree, resolve)` and `fromMarkdown(text, resolve)`: pure functions over blocks and rich text, with `resolve` looking up mention targets (title and kind, or the page a `task:` / `page:` ID stands for). The Markdown subset is the one in the spec: block types line by line (indentation of two spaces per level for nesting), inline marks by a small tokenizer (`**`, `*`, `~~`, `` ` ``, `<u>`, `[text](url)`, `@[title](kind:id)`). Unsupported or malformed syntax stays as plain text; nothing is lost silently.

### 6. Claiming from history
A work task's holder is the actor of its latest `start` transition while the task is `in_progress`. No new storage: the rule is checked in the agent handlers before calling the domain. The human (the app's UI) is never blocked. `get_task` reports `heldBy`, and `transitions` lists only what this agent may do now (filtered by permissions and claim).

### 7. Writing as the agent
Transitions call `tasks.transition(id, name, { actor, input })` (`return` passes `{ reason }`); comments call `comments.add({ author: actor, blocks: fromMarkdown(...) })`; description additions append the converted blocks after the body's last child through `blocks.apply` (task protection allows edits inside the body).

### 8. The MCP server
`mcp/src/server.ts` uses `@modelcontextprotocol/sdk` with a stdio transport. Each tool has a zod input schema mirroring the API request and a description with its defaults and caps ("Returns at most `limit` tasks (default 10, max 50) as id, kind, state, title; pass `cursor` from the previous result for more."). Results are `JSON.stringify(response)` with no indentation. Configuration errors exit at start. Run with `npx tsx mcp/src/server.ts`; a sample Claude Code config goes in `mcp/README.md`.

## Risks / Trade-offs

- [A leaked token lets anything on the machine act as an agent] → the API is off unless configured, can only do the permitted work actions, and everything is in history.
- [Markdown subset loses toggles and references on write] → they are read correctly; writing them stays out of scope and is plain text.
- [Agents polling `list_tasks`] → cheap queries at single-user scale.
