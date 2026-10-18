## ADDED Requirements

### Requirement: Agent authentication and identity
Every request to `/api/agent/*` SHALL carry `Authorization: Bearer <token>` matching the app's `AGENT_TOKEN` and an `X-Agent-Name` header naming the agent. A missing or wrong token SHALL be answered with status 401; a missing or empty name with status 400. When `AGENT_TOKEN` is not configured, every request SHALL be answered with status 403. Every change an agent makes SHALL be recorded with the actor `{ kind: "agent", name }`.

#### Scenario: Wrong token
- **WHEN** a request is made with a token that doesn't match
- **THEN** it is answered with status 401 and nothing changes

#### Scenario: API off
- **WHEN** the app runs without `AGENT_TOKEN`
- **THEN** every agent request is answered with status 403

#### Scenario: Acting as the agent
- **WHEN** the agent "builder" starts a work task
- **THEN** the task's history shows the start by "builder"

### Requirement: Lean responses
Responses SHALL contain only the fields each function documents. Lists SHALL return at most `limit` items (default 10 unless a function says otherwise, at most 50), with `more: true` and a `cursor` when there are more. Markdown texts SHALL be cut at `maxChars` characters (default 2000, at most 20000), with `more: true` and the `offset` to continue from. IDs SHALL be returned as their first 8 characters; requests SHALL accept a full ID or any prefix of at least 6 characters that matches exactly one item, and answer an ambiguous prefix with status 409. Errors SHALL be `{ error: { code, message } }` with a matching status.

#### Scenario: Paging a list
- **WHEN** a project has 25 tasks and `list_tasks` is called with `limit` 10
- **THEN** 10 tasks come back with `more: true` and a `cursor`, and calling again with that cursor returns the next 10

#### Scenario: Long description
- **WHEN** a task description is 5000 characters of Markdown and it is read with the defaults
- **THEN** the first 2000 characters come back with `more: true` and `offset: 2000`

#### Scenario: Short IDs
- **WHEN** a task is listed and then fetched by the 8-character ID from the list
- **THEN** the task is found

### Requirement: Markdown conversion
Blocks SHALL be read as Markdown: paragraphs, headings (`#`–`###`), bulleted and numbered lists (nested by indentation), todos (`- [ ]`, `- [x]`), quotes (`>`), dividers (`---`), toggles (`▸ ` followed by their title, children indented), sub-pages and page references (`[Title](page:id)`), block references (their text, quoted), marks (`**bold**`, `*italic*`, `~~strikethrough~~`, `` `code` ``, `<u>underline</u>`, `[text](url)`), and mentions (`@[Title](page:id)` or `@[Title](task:id)`). Markdown written by agents SHALL be stored as the same blocks and marks (toggles and references excepted); `@[Title](task:id)` and `@[Title](page:id)` SHALL become mentions when the target exists and plain text otherwise.

#### Scenario: Round trip
- **WHEN** an agent comments "Fixed in **two** places:\n\n- [x] parser\n- [ ] see @[Add login](task:1a2b3c4d)"
- **THEN** the comment has a paragraph with a bold span, a checked todo and an unchecked todo containing a mention of that task, and reading it back gives the same Markdown

### Requirement: Agent permissions and claiming
Agents SHALL be able to read projects, tasks, descriptions, comments, references and pages; apply `start`, `pause`, `complete` and `return` to work tasks; comment on work tasks; and append to a work task's description. Any other change SHALL be refused with status 403 (code `forbidden`). A work task an agent started SHALL be held by that agent while it is in progress: `pause`, `complete`, `return`, comments and description additions by another agent SHALL be refused with status 409 (code `claimed`, naming the holder). Transitions not allowed from the current state SHALL be refused with status 409 (code `invalid_transition`).

#### Scenario: Cancel is refused
- **WHEN** an agent tries to cancel a work task
- **THEN** it is refused with code `forbidden` and the task is unchanged

#### Scenario: Claimed by another agent
- **WHEN** "builder" started a work task and "reviewer" tries to complete it
- **THEN** it is refused with code `claimed` naming "builder", and the task stays in progress

#### Scenario: Return with a reason
- **WHEN** "builder" returns the work task it started with the reason "Missing API key"
- **THEN** the task is back in to do, its comments end with "Missing API key" by "builder", and another agent can start it

### Requirement: Agent functions
The API SHALL offer exactly these functions, each returning only the listed fields:

| Function | Request | Response |
|---|---|---|
| `GET projects` | | `{ projects: [{ id, title }] }` |
| `GET tasks` | `project?`, `kind?`, `state?`, `query?` (title contains), `limit?`, `cursor?` | `{ tasks: [{ id, kind, state, title }], more, cursor? }`, most recently updated first |
| `GET task/:id` | | `{ id, kind, state, title, project, heldBy?, transitions, counts: { comments, references } }` (`transitions`: those this agent may apply now) |
| `GET task/:id/description` | `maxChars?`, `offset?` | `{ markdown, more, offset? }` |
| `GET task/:id/comments` | `limit?` (default 5), `cursor?`, `maxChars?` (per comment, default 1000) | `{ comments: [{ id, author, markdown }], more, cursor? }`, newest first |
| `GET task/:id/references` | `limit?` | `{ references: [{ kind, id, title }], more }` (missing targets as `{ kind, id, missing: true }`) |
| `POST task/:id/transition` | `{ name, reason? }` | `{ ok: true, state }` |
| `POST task/:id/comment` | `{ markdown }` | `{ ok: true, id }` |
| `POST task/:id/description` | `{ markdown }` (appended) | `{ ok: true }` |
| `GET pages` | `query`, `limit?` | `{ pages: [{ id, title, place }], more }` |
| `GET page/:id` | `maxChars?`, `offset?` | `{ title, markdown, more, offset? }` |

#### Scenario: A work loop
- **WHEN** an agent lists to-do work, gets one task, reads its description, starts it, comments and completes it
- **THEN** each call returns only its listed fields, and the task's history and comments show the agent's name
