# agent-api Specification

## Purpose
TBD - created by archiving change agent-api. Update Purpose after archive.
## Requirements
### Requirement: Agent authentication and identity
Every request to `/api/agent/*` SHALL carry `Authorization: Bearer <token>` with the token of a registered agent that isn't revoked (see agent-tokens), and SHALL act as that agent's name; `X-Agent-Name` SHALL be ignored. A missing, unknown or revoked token SHALL be answered with status 401 (code `unauthorized`), saying to register the agent in Settings and use its token. Every change an agent makes SHALL be recorded with the actor `{ kind: "agent", name }`, its name taken from its token.

#### Scenario: Wrong token
- **WHEN** a request is made with a token that isn't registered
- **THEN** it is answered with status 401 and nothing changes

#### Scenario: The token names the agent
- **WHEN** the agent registered as "builder" starts a work task while sending `X-Agent-Name: reviewer`
- **THEN** the task's history shows the start by "builder"

#### Scenario: Revoked token
- **WHEN** an agent's token was revoked
- **THEN** its requests are answered with status 401

#### Scenario: API off
- **WHEN** no agent is registered
- **THEN** every agent request is answered with status 401

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
Blocks SHALL be read as Markdown: paragraphs, headings (`#`–`######`), bulleted and numbered lists (nested by indentation), todos (`- [ ]`, `- [x]`), quotes (`>`), dividers (`---`), toggles (`▸ ` followed by their title, children indented), sub-pages and page references (`[Title](page:id)`), block references (their text, quoted), tables (GFM pipe tables: a header row, or an empty header row when the table has none, a `---` delimiter row, then the rows; cells as inline Markdown with `\|` for a pipe and `<br>` for a line break), code blocks (a ```` ``` ```` fence with the language, the text verbatim, and a closing fence longer than any run of backticks inside), callouts (GitHub alert syntax: `> [!NOTE]`, `[!TIP]`, `[!IMPORTANT]`, `[!WARNING]` or `[!CAUTION]` for the tones default, success, info, warning and error, then the emoji and the text, children indented), marks (`**bold**`, `*italic*`, `~~strikethrough~~`, `` `code` ``, with backtick runs longer than any inside, and a space inside each, when the code holds backticks, `<u>underline</u>`, `[text](url)`), and mentions (`@[Title](page:id)` or `@[Title](task:id)`). A pending suggestion SHALL be read as a line `<suggestion id="…" by="…" action="…" status="…">` (with `target="…"` for replace and delete, and `note="…"` when it has one), its proposed blocks, and a line `</suggestion>`. Markdown written by agents SHALL be stored as the same blocks and marks (toggles and references excepted); in tables, rows SHALL be padded or cut to the header row's width and alignment markers ignored; a callout without an emoji SHALL get its tone's default emoji; text inside code fences SHALL be stored verbatim; `@[Title](task:id)` and `@[Title](page:id)` SHALL become mentions when the target exists and plain text otherwise. A trailing block anchor (` ^` and 8 hexadecimal characters) at the end of a line SHALL be dropped, and Markdown containing a `<suggestion` line SHALL be refused with status 422 (code `validation`).

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
Agents SHALL be able to read projects, tasks, descriptions, comments, references, pages and suggestions; create tasks of any kind in existing projects; create pages; suggest changes to any page or task description and withdraw their own suggestions; create projects; apply the transitions a task's kind allows from its state except the ending ones (promoting an exploration or update into work, reviving ideas, starting, pausing, completing, returning and reopening work, completing chores and cancelling one chore occurrence); suggest actions (see Agents suggest actions), including the ending transitions (cancelling work, tombstoning an exploration or update, cancelling a chore series); comment on work tasks; append to a work task's description; add findings to explorations in any state, and edit and delete their own findings. Applying an ending transition directly, approving or rejecting a suggestion, editing or deleting another author's finding, and any other change, SHALL be refused with status 403 (code `forbidden`). A work task an agent started SHALL be held by that agent while it is in progress: its transitions, comments and description additions by another agent SHALL be refused with status 409 (code `claimed`, naming the holder); suggestions on its description SHALL be allowed. Transitions not allowed from the current state SHALL be refused with status 409 (code `invalid_transition`).

#### Scenario: Promote an exploration
- **WHEN** an agent applies `promote` to an open exploration, with or without a `title`
- **THEN** the exploration is promoted, a work task born from it is created (titled after the idea when no title is given), and the answer carries its ID as `work`

#### Scenario: Comments on ideas are refused
- **WHEN** an agent tries to comment on an exploration
- **THEN** it is refused with code `forbidden`

#### Scenario: Claimed by another agent
- **WHEN** "builder" started a work task and "reviewer" tries to complete it
- **THEN** it is refused with code `claimed` naming "builder", and the task stays in progress

#### Scenario: Return with a reason
- **WHEN** "builder" returns the work task it started with the reason "Missing API key"
- **THEN** the task is back in to do, its comments end with "Missing API key" by "builder", and another agent can start it

#### Scenario: Suggesting on held work
- **WHEN** "builder" holds a work task and "reviewer" suggests inserting a paragraph into its description
- **THEN** the suggestion is created and pending

#### Scenario: Findings on an exploration
- **WHEN** agent "builder" adds a finding to an open exploration
- **THEN** the finding is created by "builder", and the exploration's state and description are unchanged

#### Scenario: Another author's finding
- **WHEN** agent "reviewer" tries to edit or delete a finding by "builder", or one written by the human
- **THEN** it is refused with code `forbidden` and the finding is unchanged

#### Scenario: Ending transitions are suggested
- **WHEN** an agent applies `cancel` to a work task in to do
- **THEN** it is refused with code `forbidden`, the task stays in to do, and `GET task/:id` never listed `cancel` in its `transitions`

#### Scenario: Skipping one chore occurrence stays direct
- **WHEN** an agent cancels a weekly chore with scope `occurrence`
- **THEN** it is cancelled and the next occurrence exists

### Requirement: Agent functions
The API SHALL offer exactly these functions, each returning only the listed fields. Functions that take Markdown (`POST tasks` `description`, `POST task/:id/comment`, `POST task/:id/finding`, `POST finding/:id`, `POST task/:id/description`, `POST pages`, `POST suggest`, `POST suggestion/:id/revise`) SHALL also return `warnings` when the Markdown held unsupported constructs (see Markdown guide and warnings), and only then:

| Function | Request | Response |
|---|---|---|
| `GET projects` | | `{ projects: [{ id, title }] }` |
| `POST projects` | `{ title }` | `{ ok: true, id }` |
| `GET tasks` | `project?`, `kind?`, `state?`, `query?` (title contains), `limit?`, `cursor?` | `{ tasks: [{ id, kind, state, title }], more, cursor? }`, most recently updated first |
| `POST tasks` | `{ project, kind, title, description?, urgency?, schedule?, iteratesOn? }` | `{ ok: true, id, state }` |
| `GET task/:id` | | `{ id, kind, state, title, project, heldBy?, transitions, counts: { comments, references, findings? } }` (`transitions`: those this agent may apply now, never the ending ones; `findings` for explorations only) |
| `GET task/:id/description` | `maxChars?`, `offset?`, `anchors?` | `{ markdown, more, offset?, assets? }` |
| `GET task/:id/asset/:asset` | | `{ id, type, size, width?, height?, data }` (see Agents read images) |
| `GET task/:id/comments` | `limit?` (default 5), `cursor?`, `maxChars?` (per comment, default 1000) | `{ comments: [{ id, author, markdown }], more, cursor? }`, newest first |
| `GET task/:id/references` | `limit?` | `{ references: [{ kind, id, title }], more }` (missing targets as `{ kind, id, missing: true }`) |
| `POST task/:id/transition` | `{ name, reason?, title?, next?, scope? }` (`reason` for work `return`, `title` for `promote`, `next` for chore `complete`, `scope` for chore `cancel`) | `{ ok: true, state, work? }` (`work`: the new work's ID after `promote`) |
| `POST task/:id/comment` | `{ markdown }` | `{ ok: true, id }` |
| `GET task/:id/findings` | `limit?` (default 5), `cursor?`, `maxChars?` (per finding, default 1000) | `{ findings: [{ id, author, markdown }], more, cursor? }`, newest first |
| `POST task/:id/finding` | `{ markdown }` (an exploration) | `{ ok: true, id }` |
| `POST finding/:id` | `{ markdown }` (replaces the content of the caller's own finding) | `{ ok: true }` |
| `POST finding/:id/delete` | | `{ ok: true }` |
| `POST task/:id/description` | `{ markdown }` (appended) | `{ ok: true }` |
| `GET pages` | `query`, `limit?` | `{ pages: [{ id, title, place }], more }` |
| `POST pages` | `{ title, project?, parent?, markdown? }` | `{ ok: true, id }` |
| `GET page/:id` | `maxChars?`, `offset?`, `anchors?` | `{ title, markdown, more, offset?, assets? }` |
| `GET page/:id/asset/:asset` | | `{ id, type, size, width?, height?, data }` (see Agents read images) |
| `POST suggest` | `{ page? , task?, action, after?, inside?, target?, markdown?, note? }` | `{ ok: true, id }` |
| `POST suggest-action` | `{ action, project? , page? , task?, title?, schedule?, transition?, scope?, note? }` | `{ ok: true, id }` |
| `GET suggestions` | `state?` (`pending`, `outdated` or `changes_requested`), `limit?` (default 10), `cursor?` | `{ suggestions: [{ id, action, status, place, subject? }], more, cursor? }`: the caller's own open suggestions, oldest first |
| `GET suggestion/:id` | | `{ id, action, status, place, subject?, revision, note?, feedback?, resolvedAt? }` (`place`: `page:<id>` or `task:<id>`; `subject`, for action suggestions: `project:<id>`, `page:<id>` or `task:<id>`; `feedback`, while `changes_requested`: `[{ text, at }]`, oldest first) |
| `POST suggestion/:id/withdraw` | | `{ ok: true }` |
| `POST suggestion/:id/revise` | `{ markdown?, title?, schedule?, note? }` | `{ ok: true, revision }` |
| `GET markdown` | | `{ blocks: [{ type, markdown, example }], inline: [{ name, markdown }], unsupported: [{ name, markdown, kept }] }` |

#### Scenario: A work loop
- **WHEN** an agent lists to-do work, gets one task, reads its description, starts it, comments and completes it
- **THEN** each call returns only its listed fields, and the task's history and comments show the agent's name

#### Scenario: Recording an exploration's results
- **WHEN** an agent reads an exploration, adds a finding, then edits that finding
- **THEN** `GET task/:id/findings` returns it first, with the edited Markdown and the agent as author, and `GET task/:id` counts 1 finding

#### Scenario: Finding on the wrong kind
- **WHEN** an agent adds a finding to a work task
- **THEN** it is refused with code `validation` and nothing is created

#### Scenario: Comment and finding IDs don't mix
- **WHEN** an agent calls `POST finding/:id` with the ID of a comment
- **THEN** it is refused with code `not_found`

#### Scenario: Revising after feedback
- **WHEN** an agent lists its suggestions with `state: "changes_requested"`, reads one with `GET suggestion/:id`, and revises it
- **THEN** the list includes it, the read shows its `feedback`, and after `POST suggestion/:id/revise` it is `pending` with the next `revision`

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

### Requirement: Agents create projects
`POST projects` SHALL create a project titled `title`, with its home page and library, as creating one in the app does, and return its ID. A missing or empty title SHALL be refused with status 422 (code `validation`) and nothing SHALL be created.

#### Scenario: Create a project
- **WHEN** "planner" creates the project "Garden"
- **THEN** the answer is `{ ok: true, id }`, and `GET projects` lists "Garden" with that ID

### Requirement: Agents suggest actions
`POST suggest-action` SHALL create an action suggestion (see action-suggestions) by the calling agent, on exactly one subject: `project`, `page` or `task` (IDs or 8-character prefixes). `action` SHALL be `rename` (with `title`), `delete`, `schedule` (with `schedule`, a `chore-scheduling` schedule as for `POST tasks`, or `null` to remove it) or `transition` (with `transition`: `cancel` or `tombstone`, and `scope: "series"` for a chore's `cancel`). Fields that don't belong to the action SHALL be refused. `note` SHALL be at most 280 characters. A request that breaks these rules or the rules of action-suggestions SHALL be refused with status 422 (code `validation`); an unknown subject with status 404 (code `not_found`); nothing SHALL be created when a request is refused. `GET suggestion/:id` and `POST suggestion/:id/withdraw` SHALL work for action suggestions as for block suggestions.

#### Scenario: Suggest cancelling work
- **WHEN** "builder" suggests `transition` `cancel` on a work task in to do, with the note "Superseded by the new importer"
- **THEN** the answer is `{ ok: true, id }`, the task stays in to do, and `GET suggestion/:id` reports `pending` with `subject` `task:<id>`

#### Scenario: Title missing
- **WHEN** an agent suggests `rename` without a `title`
- **THEN** it is refused with code `validation` and nothing is created

#### Scenario: Two subjects
- **WHEN** an agent suggests `delete` with both a `page` and a `task`
- **THEN** it is refused with code `validation` and nothing is created

#### Scenario: Status after approval
- **WHEN** the human approves an agent's rename suggestion and the agent asks for its status
- **THEN** the answer reports `approved` with `resolvedAt`

### Requirement: Agents revise suggestions
`GET suggestions` SHALL list the calling agent's own suggestions that are still open (`pending`, `outdated` or `changes_requested`, as reported), oldest first, paged like `GET tasks`; `state` SHALL narrow it to one of those states. Other agents' suggestions SHALL NOT be listed. `GET suggestion/:id` SHALL report the suggestion's `revision`, its `note` when it has one, and, while it's `changes_requested`, its open `feedback`. `POST suggestion/:id/revise` SHALL revise the calling agent's own open suggestion (see suggestion-feedback): `markdown` (the new proposed blocks of a block insert or replace), `title` (a rename), `schedule` (a schedule suggestion: a `chore-scheduling` schedule, or `null`), and `note` (at most 280 characters). Fields that don't belong to the suggestion's action SHALL be refused, and so SHALL a request with none of them. A revision SHALL be refused with status 422 (code `validation`) when it breaks these rules or the rules of suggesting; with status 403 (code `forbidden`) for another agent's suggestion; with status 409 (code `resolved`) for a resolved one; and with status 404 (code `not_found`) for an unknown suggestion. Nothing SHALL change when a request is refused.

#### Scenario: Find feedback
- **WHEN** the human requested changes on one of "claude"'s two pending suggestions, and "claude" calls `GET suggestions` with `state: "changes_requested"`
- **THEN** only that suggestion is listed, with status `changes_requested`

#### Scenario: Read feedback
- **WHEN** "claude" calls `GET suggestion/:id` on it
- **THEN** the answer includes `revision: 1` and `feedback: [{ text: "Shorter, please", at }]`

#### Scenario: Revise with a title
- **WHEN** "claude" calls `POST suggestion/:id/revise` on its rename suggestion with `title: "Plans"` and `note: "Shortened"`
- **THEN** the answer is `{ ok: true, revision: 2 }`, and `GET suggestion/:id` reports `pending` with the note "Shortened" and no `feedback`

#### Scenario: Wrong field for the action
- **WHEN** an agent revises a delete suggestion with `markdown`
- **THEN** it is refused with code `validation` and nothing changes

#### Scenario: Another agent's list
- **WHEN** "reviewer" calls `GET suggestions`
- **THEN** suggestions made by "claude" are not listed

### Requirement: Agents read images
`GET page/:id` and `GET task/:id/description` SHALL answer `assets`, the uploaded images in the whole page or description (pending suggestions included, not only the part cut by `maxChars`), in document order, each once, as `[{ id, alt }]`; `id` is the uploaded item's ID, the last segment of its URL in the Markdown. `assets` SHALL be left out when there are none, and external images SHALL never be listed. `GET page/:id/asset/:asset` and `GET task/:id/asset/:asset` SHALL answer one of those images as `{ id, type, size, width?, height?, data }`: its MIME type (`image/png`, `image/jpeg`, `image/gif` or `image/webp`), its size in bytes, its pixel dimensions when they can be read from its header, and its bytes in base64. The page or task SHALL be resolved as for `GET page/:id` and `GET task/:id`; an item not used by an image block in it (another page's, a malformed ID, or an external URL) SHALL be refused with status 404 (code `not_found`) without reading storage, and an item it uses whose bytes are gone with status 404 (code `missing`). Messages SHALL name the asset ID and never a storage path. Nothing outside the content repository SHALL be fetched.

#### Scenario: Listing a page's images
- **WHEN** a page holds an uploaded screenshot "Error dialog", the same screenshot again, and an external chart image
- **THEN** `GET page/:id` answers `assets: [{ id: "<sha>.png", alt: "Error dialog" }]`, and its Markdown is as before

#### Scenario: Reading an image
- **WHEN** an agent calls `GET page/:id/asset/<sha>.png` for a 1200×800 PNG on that page
- **THEN** the answer is `{ id, type: "image/png", size, width: 1200, height: 800, data }`, and `data` decodes to the stored bytes

#### Scenario: An image from another page
- **WHEN** an agent asks for an uploaded image's ID through a page that doesn't hold it
- **THEN** it is refused with code `not_found`, and nothing is read from storage

#### Scenario: A screenshot in a task description
- **WHEN** a bug task's description holds an uploaded JPEG
- **THEN** `GET task/:id/description` lists it in `assets`, and `GET task/:id/asset/:asset` answers it with `type: "image/jpeg"`

