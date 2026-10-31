## 1. Domain and storage

- [x] 1.1 `db/migrations/006_findings.sql`: `kind TEXT NOT NULL DEFAULT 'comment' CHECK (kind IN ('comment', 'finding'))` on `comments`
- [x] 1.2 `Comment.kind` in `src/domain/comments/types.ts`; `listByTask(taskId, kind?)` in the repository port, and the SQLite and in-memory repositories storing and filtering by it; repository tests with both kinds in one table
- [x] 1.3 `CommentService`: `add` takes `kind` (default `comment`) and checks it against one table (comments on work and chores, findings on explorations), with "A … is a document itself and cannot have comments" kept for comments and "Only explorations have findings" for findings; `list(taskId, kind)`; `return`'s comment passes `comment`; tests per kind, including promoting an exploration with findings
- [x] 1.4 Task deletion and project deletion remove findings (they go through `listByTask` without a kind); the deletion count covers comments and findings; tests

## 2. Task page

- [x] 2.1 `task-overview.server.ts`: `findings` for explorations, built like `comments`; `task-actions.server.ts`: add, edit and delete intents for findings, which look the record up by ID and kind and reject an empty finding ("The finding is empty")
- [x] 2.2 Generalize `TaskComments` (labels, empty state, anchor prefix, intents) and use it for findings without "Start exploration…"; `task.tsx`: the Findings tab between Description and Lineage with its count, and `#finding-<id>` opening it
- [x] 2.3 The delete dialog's count says findings for explorations; tests in `tests/app/task-screen.test.ts` for adding, editing, deleting, an empty finding, the tabs and the link

## 3. Agent API and MCP

- [x] 3.1 `functions.server.ts`: `listFindings`, `addFinding` (no `checkWork`), `editFinding` (replaces the body's children from Markdown, only for the caller's own finding, otherwise `forbidden`) and `deleteFinding` (own only); comment and finding IDs resolved only within their own kind (`not_found` otherwise); `counts.findings` for explorations in `GET task/:id`; routes in `api.agent.ts`
- [x] 3.2 `mcp/tools.ts`: `list_findings`, `add_finding`, `edit_finding` and `delete_finding`, with descriptions as specified; `mcp/README.md`
- [x] 3.3 Tests in `tests/app/agent-api.test.ts` (adding, the wrong kind, another author, mixed IDs, counts) and `tests/mcp.test.ts`

## 4. Check

- [x] 4.1 Typecheck, unit tests and the Playwright suite; a Playwright check of adding a finding on an exploration and following a `#finding-` link
- [ ] 4.2 After deploying, add the decision on "What agents are allowed to do" as a finding through MCP
