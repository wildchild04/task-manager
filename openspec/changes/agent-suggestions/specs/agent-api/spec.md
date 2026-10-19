## MODIFIED Requirements

### Requirement: Markdown conversion
Blocks SHALL be read as Markdown: paragraphs, headings (`#`–`###`), bulleted and numbered lists (nested by indentation), todos (`- [ ]`, `- [x]`), quotes (`>`), dividers (`---`), toggles (`▸ ` followed by their title, children indented), sub-pages and page references (`[Title](page:id)`), block references (their text, quoted), marks (`**bold**`, `*italic*`, `~~strikethrough~~`, `` `code` ``, `<u>underline</u>`, `[text](url)`), and mentions (`@[Title](page:id)` or `@[Title](task:id)`). A pending suggestion SHALL be read as a line `<suggestion id="…" by="…" action="…" status="…">` (with `target="…"` for replace and delete, and `note="…"` when it has one), its proposed blocks, and a line `</suggestion>`. Markdown written by agents SHALL be stored as the same blocks and marks (toggles and references excepted); `@[Title](task:id)` and `@[Title](page:id)` SHALL become mentions when the target exists and plain text otherwise. A trailing block anchor (` ^` and 8 hexadecimal characters) at the end of a line SHALL be dropped, and Markdown containing a `<suggestion` line SHALL be refused with status 422 (code `validation`).

#### Scenario: Round trip
- **WHEN** an agent comments "Fixed in **two** places:\n\n- [x] parser\n- [ ] see @[Add login](task:1a2b3c4d)"
- **THEN** the comment has a paragraph with a bold span, a checked todo and an unchecked todo containing a mention of that task, and reading it back gives the same Markdown

#### Scenario: Another agent's suggestion is visible
- **WHEN** "reviewer" reads a page on which "builder" has a pending insert suggestion with the note "Add tables"
- **THEN** the Markdown contains `<suggestion id="…" by="builder" action="insert" status="pending" note="Add tables">`, the proposed blocks, and `</suggestion>`, where the suggestion is

### Requirement: Agent permissions and claiming
Agents SHALL be able to read projects, tasks, descriptions, comments, references, pages and suggestions; create tasks of any kind in existing projects; create pages; suggest changes to any page or task description; apply `start`, `pause`, `complete` and `return` to work tasks; comment on work tasks; and append to a work task's description. Approving or rejecting a suggestion, and any other change, SHALL be refused with status 403 (code `forbidden`). A work task an agent started SHALL be held by that agent while it is in progress: `pause`, `complete`, `return`, comments and description additions by another agent SHALL be refused with status 409 (code `claimed`, naming the holder); suggestions on its description SHALL be allowed. Transitions not allowed from the current state SHALL be refused with status 409 (code `invalid_transition`).

#### Scenario: Cancel is refused
- **WHEN** an agent tries to cancel a work task
- **THEN** it is refused with code `forbidden` and the task is unchanged

#### Scenario: Claimed by another agent
- **WHEN** "builder" started a work task and "reviewer" tries to complete it
- **THEN** it is refused with code `claimed` naming "builder", and the task stays in progress

#### Scenario: Return with a reason
- **WHEN** "builder" returns the work task it started with the reason "Missing API key"
- **THEN** the task is back in to do, its comments end with "Missing API key" by "builder", and another agent can start it

#### Scenario: Suggesting on held work
- **WHEN** "builder" holds a work task and "reviewer" suggests inserting a paragraph into its description
- **THEN** the suggestion is created and pending

### Requirement: Agent functions
The API SHALL offer exactly these functions, each returning only the listed fields:

| Function | Request | Response |
|---|---|---|
| `GET projects` | | `{ projects: [{ id, title }] }` |
| `GET tasks` | `project?`, `kind?`, `state?`, `query?` (title contains), `limit?`, `cursor?` | `{ tasks: [{ id, kind, state, title }], more, cursor? }`, most recently updated first |
| `POST tasks` | `{ project, kind, title, description?, urgency?, schedule?, iteratesOn? }` | `{ ok: true, id, state }` |
| `GET task/:id` | | `{ id, kind, state, title, project, heldBy?, transitions, counts: { comments, references } }` (`transitions`: those this agent may apply now) |
| `GET task/:id/description` | `maxChars?`, `offset?`, `anchors?` | `{ markdown, more, offset? }` |
| `GET task/:id/comments` | `limit?` (default 5), `cursor?`, `maxChars?` (per comment, default 1000) | `{ comments: [{ id, author, markdown }], more, cursor? }`, newest first |
| `GET task/:id/references` | `limit?` | `{ references: [{ kind, id, title }], more }` (missing targets as `{ kind, id, missing: true }`) |
| `POST task/:id/transition` | `{ name, reason? }` | `{ ok: true, state }` |
| `POST task/:id/comment` | `{ markdown }` | `{ ok: true, id }` |
| `POST task/:id/description` | `{ markdown }` (appended) | `{ ok: true }` |
| `GET pages` | `query`, `limit?` | `{ pages: [{ id, title, place }], more }` |
| `POST pages` | `{ title, project?, parent?, markdown? }` | `{ ok: true, id }` |
| `GET page/:id` | `maxChars?`, `offset?`, `anchors?` | `{ title, markdown, more, offset? }` |
| `POST suggest` | `{ page? , task?, action, after?, inside?, target?, markdown?, note? }` | `{ ok: true, id }` |
| `GET suggestion/:id` | | `{ id, action, status, place, resolvedAt? }` (`place`: `page:<id>` or `task:<id>`) |

#### Scenario: A work loop
- **WHEN** an agent lists to-do work, gets one task, reads its description, starts it, comments and completes it
- **THEN** each call returns only its listed fields, and the task's history and comments show the agent's name

## ADDED Requirements

### Requirement: Block anchors
`GET page/:id` and `GET task/:id/description` with `anchors: true` SHALL end the first line of every block's Markdown with ` ^` and the block's 8-character ID; without it, no anchors SHALL be added. Anchors SHALL count toward `maxChars`.

#### Scenario: Read with anchors
- **WHEN** an agent reads a page holding the heading "Goals" and the paragraph "Ship it" with `anchors: true`
- **THEN** the Markdown is "## Goals ^1a2b3c4d\n\nShip it ^5e6f7a8b", where the IDs are those of the two blocks

### Requirement: Agents suggest changes
`POST suggest` SHALL create a suggestion (see agent-suggestions) by the calling agent, on `page` (a page ID as for `GET page/:id`) or on `task` (a task ID: its description), exactly one of them. For `insert`, `after` (a block to follow) or `inside` (a block to append under) MAY be given, at most one, and the end of the page is the default; `markdown` holds the proposed blocks. For `replace`, `target` and `markdown` are required; for `delete`, `target` is required and `markdown` SHALL NOT be given. Block IDs SHALL be resolved by their 8-character prefix within the page's own content. `note` SHALL be at most 280 characters. A request that breaks these rules or the placement rules of agent-suggestions SHALL be refused with status 422 (code `validation`); an unknown page, task or block with status 404 (code `not_found`); nothing SHALL be created when a request is refused. `GET suggestion/:id` SHALL report the suggestion's status: `pending`, `outdated`, `approved` or `rejected`.

#### Scenario: Suggest bullets into an exploration
- **WHEN** "planner" reads exploration "Block editor v1" with anchors and suggests inserting "- Tables\n- Code blocks" after its last bullet, with the note "From the content audit"
- **THEN** the answer is `{ ok: true, id }`, the description shows the pending suggestion after that bullet, and `GET suggestion/:id` reports `pending`

#### Scenario: Replace needs Markdown
- **WHEN** an agent suggests a `replace` with a target and no `markdown`
- **THEN** it is refused with code `validation` and nothing is created

#### Scenario: Status after approval
- **WHEN** the human approves a suggestion and its agent asks for its status
- **THEN** the answer reports `approved` with `resolvedAt`
