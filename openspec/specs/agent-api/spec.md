# agent-api Specification

## Purpose
TBD - created by archiving change agent-api. Update Purpose after archive.
## Requirements
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
Blocks SHALL be read as Markdown: paragraphs, headings (`#`–`######`), bulleted and numbered lists (nested by indentation), todos (`- [ ]`, `- [x]`), quotes (`>`), dividers (`---`), toggles (`▸ ` followed by their title, children indented), sub-pages and page references (`[Title](page:id)`), block references (their text, quoted), tables (GFM pipe tables: a header row, or an empty header row when the table has none, a `---` delimiter row, then the rows; cells as inline Markdown with `\|` for a pipe and `<br>` for a line break), code blocks (a ```` ``` ```` fence with the language, the text verbatim, and a closing fence longer than any run of backticks inside), callouts (GitHub alert syntax: `> [!NOTE]`, `[!TIP]`, `[!IMPORTANT]`, `[!WARNING]` or `[!CAUTION]` for the tones default, success, info, warning and error, then the emoji and the text, children indented), marks (`**bold**`, `*italic*`, `~~strikethrough~~`, `` `code` ``, `<u>underline</u>`, `[text](url)`), and mentions (`@[Title](page:id)` or `@[Title](task:id)`). A pending suggestion SHALL be read as a line `<suggestion id="…" by="…" action="…" status="…">` (with `target="…"` for replace and delete, and `note="…"` when it has one), its proposed blocks, and a line `</suggestion>`. Markdown written by agents SHALL be stored as the same blocks and marks (toggles and references excepted); in tables, rows SHALL be padded or cut to the header row's width and alignment markers ignored; a callout without an emoji SHALL get its tone's default emoji; text inside code fences SHALL be stored verbatim; `@[Title](task:id)` and `@[Title](page:id)` SHALL become mentions when the target exists and plain text otherwise. A trailing block anchor (` ^` and 8 hexadecimal characters) at the end of a line SHALL be dropped, and Markdown containing a `<suggestion` line SHALL be refused with status 422 (code `validation`).

#### Scenario: Round trip
- **WHEN** an agent comments "Fixed in **two** places:\n\n- [x] parser\n- [ ] see @[Add login](task:1a2b3c4d)"
- **THEN** the comment has a paragraph with a bold span, a checked todo and an unchecked todo containing a mention of that task, and reading it back gives the same Markdown

#### Scenario: Another agent's suggestion is visible
- **WHEN** "reviewer" reads a page on which "builder" has a pending insert suggestion with the note "Add tables"
- **THEN** the Markdown contains `<suggestion id="…" by="builder" action="insert" status="pending" note="Add tables">`, the proposed blocks, and `</suggestion>`, where the suggestion is

#### Scenario: A table round trip
- **WHEN** an agent creates a page with "| Subtopic | Rating |\n|---|---|\n| DNS | 🟡 **Shaky** |"
- **THEN** the page has a table with a header row and one row of two cells, the second cell's "Shaky" bold, and reading the page gives the same Markdown

#### Scenario: Code and callout round trip
- **WHEN** an agent writes "```sh\nstrace -f ./server\n```\n\n> [!WARNING] ⚠️ Don't load a movement that scored 0"
- **THEN** the page has a code block with language "sh" holding that line and a warning callout with the emoji ⚠️, and reading it gives the same Markdown

### Requirement: Agent permissions and claiming
Agents SHALL be able to read projects, tasks, descriptions, comments, references, pages and suggestions; create tasks of any kind in existing projects; create pages; suggest changes to any page or task description and withdraw their own suggestions; apply `start`, `pause`, `complete` and `return` to work tasks; comment on work tasks; and append to a work task's description. Approving or rejecting a suggestion, and any other change, SHALL be refused with status 403 (code `forbidden`). A work task an agent started SHALL be held by that agent while it is in progress: `pause`, `complete`, `return`, comments and description additions by another agent SHALL be refused with status 409 (code `claimed`, naming the holder); suggestions on its description SHALL be allowed. Transitions not allowed from the current state SHALL be refused with status 409 (code `invalid_transition`).

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
The API SHALL offer exactly these functions, each returning only the listed fields. Functions that take Markdown (`POST tasks` `description`, `POST task/:id/comment`, `POST task/:id/description`, `POST pages`, `POST suggest`) SHALL also return `warnings` when the Markdown held unsupported constructs (see Markdown guide and warnings), and only then:

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
| `POST suggestion/:id/withdraw` | | `{ ok: true }` |
| `GET markdown` | | `{ blocks: [{ type, markdown, example }], inline: [{ name, markdown }], unsupported: [{ name, markdown, kept }] }` |

#### Scenario: A work loop
- **WHEN** an agent lists to-do work, gets one task, reads its description, starts it, comments and completes it
- **THEN** each call returns only its listed fields, and the task's history and comments show the agent's name

### Requirement: Agents create tasks
`POST tasks` SHALL create a task of `kind` (exploration, work, chore or update) titled `title` in `project` (a project ID or its 8-character prefix), in the kind's initial state, as the web forms do. `description`, in the Markdown of the `Markdown conversion` requirement, SHALL become the task's description. Chores MAY take `urgency` (`normal` by default) and `schedule` (the schedule types of `chore-scheduling`, e.g. `{ type: "frequency", every: "weekly", weekday: 1, time: "09:00" }`), and their due time SHALL be computed from it. Updates SHALL take `iteratesOn`, a done work task. A missing title, an unknown kind, invalid chore fields, or `urgency`/`schedule`/`iteratesOn` on a kind that doesn't take them SHALL be refused with status 422 (code `validation`); an unknown project or task with status 404 (code `not_found`). Nothing SHALL be created when a request is refused.

#### Scenario: Create work with a description
- **WHEN** "planner" creates work "Add login" in the project with the description "Use **OAuth**"
- **THEN** the answer is `{ ok: true, id, state: "todo" }`, the project's work list shows "Add login", and reading its description gives "Use **OAuth**"

#### Scenario: Create a scheduled chore
- **WHEN** an agent creates a chore "Back up the database" with schedule weekly on Monday at 09:00
- **THEN** the chore is in to do, due next Monday at 09:00 in the workspace time zone

#### Scenario: Update needs done work
- **WHEN** an agent creates an update iterating on work that is still in to do
- **THEN** it is refused with code `validation` and no task is created

### Requirement: Agents create pages
`POST pages` SHALL create a page titled `title`, after the existing pages in its place, as the web forms do. Without `project` or `parent` it SHALL be a top-level workspace page; with `project` (a project ID or its 8-character prefix) a document at the top of that project's knowledge library; with `parent` (any page `GET pages` finds, by ID or prefix) a page nested in that page, in the same workspace or library. `markdown`, in the Markdown of the `Markdown conversion` requirement, SHALL become the page's content. A missing title or both `project` and `parent` SHALL be refused with status 422 (code `validation`); an unknown project or page with status 404 (code `not_found`). Nothing SHALL be created when a request is refused, including when the content can't be stored.

#### Scenario: A global page with content
- **WHEN** "planner" creates the page "Runbook" with "## Deploy\n\n- [ ] Tag the release"
- **THEN** the answer is `{ ok: true, id }`, "Runbook" is the last workspace page, and reading it gives the same Markdown

#### Scenario: A library document and a nested page
- **WHEN** an agent creates "Architecture" in the project, then "Layers" with `parent` set to Architecture's ID
- **THEN** the project's library shows Architecture containing Layers, and searching "layers" gives the place "Taskhub › Architecture"

#### Scenario: Ambiguous place
- **WHEN** an agent creates a page with both `project` and `parent`
- **THEN** it is refused with code `validation` and no page is created

### Requirement: Block anchors
`GET page/:id` and `GET task/:id/description` with `anchors: true` SHALL end the first line of every block's Markdown with ` ^` and the block's 8-character ID; without it, no anchors SHALL be added. Anchors SHALL count toward `maxChars`.

#### Scenario: Read with anchors
- **WHEN** an agent reads a page holding the heading "Goals" and the paragraph "Ship it" with `anchors: true`
- **THEN** the Markdown is "## Goals ^1a2b3c4d\n\nShip it ^5e6f7a8b", where the IDs are those of the two blocks

### Requirement: Agents suggest changes
`POST suggest` SHALL create a suggestion (see agent-suggestions) by the calling agent, on `page` (a page ID as for `GET page/:id`) or on `task` (a task ID: its description), exactly one of them. For `insert`, `after` (a block to follow) or `inside` (a block to append under) MAY be given, at most one, and the end of the page is the default; `markdown` holds the proposed blocks. For `replace`, `target` and `markdown` are required; for `delete`, `target` is required and `markdown` SHALL NOT be given. Block IDs SHALL be resolved by their 8-character prefix within the page's own content. `note` SHALL be at most 280 characters. A request that breaks these rules or the placement rules of agent-suggestions SHALL be refused with status 422 (code `validation`); an unknown page, task or block with status 404 (code `not_found`); nothing SHALL be created when a request is refused. `GET suggestion/:id` SHALL report the suggestion's status: `pending`, `outdated`, `approved`, `rejected` or `withdrawn`. `POST suggestion/:id/withdraw` SHALL withdraw the calling agent's own pending or outdated suggestion; another agent's SHALL be refused with status 403 (code `forbidden`), and a resolved one with status 409 (code `resolved`).

#### Scenario: Suggest bullets into an exploration
- **WHEN** "planner" reads exploration "Block editor v1" with anchors and suggests inserting "- Tables\n- Code blocks" after its last bullet, with the note "From the content audit"
- **THEN** the answer is `{ ok: true, id }`, the description shows the pending suggestion after that bullet, and `GET suggestion/:id` reports `pending`

#### Scenario: Replace needs Markdown
- **WHEN** an agent suggests a `replace` with a target and no `markdown`
- **THEN** it is refused with code `validation` and nothing is created

#### Scenario: Withdraw another agent's suggestion
- **WHEN** "reviewer" calls `POST suggestion/:id/withdraw` on a suggestion by "builder"
- **THEN** it is refused with code `forbidden` and the suggestion stays pending

#### Scenario: Status after approval
- **WHEN** the human approves a suggestion and its agent asks for its status
- **THEN** the answer reports `approved` with `resolvedAt`

### Requirement: Markdown guide and warnings
`GET markdown` SHALL describe the Markdown agents may write: every block type with its syntax and an example (paragraphs, headings 1–6, bulleted, numbered and todo lists, toggles, quotes, dividers, tables, code blocks, callouts, images), the inline marks, links and mentions, and the constructs that aren't supported with what happens to them. Every block type the importer creates SHALL be listed. When a write's Markdown contains an image whose source isn't an `http(s)` URL or an uploaded item, an image inside a line of text, HTML other than `<u>`, a footnote (`[^1]`), rows of `|` cells without a separator row, or an unclosed code fence, the write SHALL still succeed, keep that text as written, and return `warnings`, one per occurrence, naming its line and what was kept (for example `"Line 12: images need an http(s) URL or an uploaded image; kept as text"`). Writes without such constructs SHALL return no `warnings` field.

#### Scenario: Asking what's supported
- **WHEN** an agent calls `GET markdown`
- **THEN** the answer lists `table` with its pipe syntax and an example, `code` with fences, and `image` with `![alt](https://…)` and the rule that it stands on its own line

#### Scenario: Image with a relative path
- **WHEN** an agent creates a page whose Markdown has a paragraph, then `![chart](chart.png)` on line 3
- **THEN** the page is created with both lines as text, and the answer is `{ ok: true, id, warnings: ["Line 3: images need an http(s) URL or an uploaded image; kept as text"] }`

#### Scenario: Nothing unsupported
- **WHEN** an agent comments with a table and a code block
- **THEN** the answer is `{ ok: true, id }`, with no `warnings`

### Requirement: Images in Markdown
A line that is only `![alt](src)` SHALL become an image block: a `src` naming an uploaded item (a `/content/<id>` URL, relative or absolute) SHALL become that item, and another `http:` or `https:` URL SHALL become an external image. Image blocks SHALL be written as `![alt](url)` on a line of their own, an uploaded item's URL absolute (with the app's origin and base path). Copying from the editor and pasting HTML (`<img src alt>`) SHALL follow the same rules.

#### Scenario: An agent adds a chart by URL
- **WHEN** an agent appends Markdown with the line `![Latency p95](https://grafana.example/render/p95.png)`
- **THEN** the page gets an image block with that URL and alt text, and the answer has no `warnings`

#### Scenario: Reading an uploaded image
- **WHEN** an agent reads a page holding an uploaded screenshot with alt text "Error dialog"
- **THEN** the Markdown has `![Error dialog](https://<host>/task-manager/content/<id>.png)` on its own line
