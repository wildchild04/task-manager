## MODIFIED Requirements

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

## ADDED Requirements

### Requirement: Markdown guide and warnings
`GET markdown` SHALL describe the Markdown agents may write: every block type with its syntax and an example (paragraphs, headings 1–6, bulleted, numbered and todo lists, toggles, quotes, dividers, tables, code blocks, callouts), the inline marks, links and mentions, and the constructs that aren't supported with what happens to them. Every block type the importer creates SHALL be listed. When a write's Markdown contains an image (`![alt](src)`), HTML other than `<u>`, a footnote (`[^1]`), rows of `|` cells without a separator row, or an unclosed code fence, the write SHALL still succeed, keep that text as written, and return `warnings`, one per occurrence, naming its line and what was kept (for example `"Line 12: images aren't supported yet; kept as text"`). Writes without such constructs SHALL return no `warnings` field.

#### Scenario: Asking what's supported
- **WHEN** an agent calls `GET markdown`
- **THEN** the answer lists `table` with its pipe syntax and an example, `code` with fences, and images under `unsupported`

#### Scenario: Image in a new page
- **WHEN** an agent creates a page whose Markdown has a paragraph, then `![chart](chart.png)` on line 3
- **THEN** the page is created with both lines as text, and the answer is `{ ok: true, id, warnings: ["Line 3: images aren't supported yet; kept as text"] }`

#### Scenario: Nothing unsupported
- **WHEN** an agent comments with a table and a code block
- **THEN** the answer is `{ ok: true, id }`, with no `warnings`
