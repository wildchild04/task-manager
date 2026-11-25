## MODIFIED Requirements

### Requirement: Markdown conversion
Blocks SHALL be read as Markdown: paragraphs, headings (`#`–`######`), bulleted and numbered lists (nested by indentation), todos (`- [ ]`, `- [x]`), quotes (`>`), dividers (`---`), toggles (`▸ ` followed by their title, children indented), sub-pages and page references (`[Title](page:id)`), block references (their text, quoted), tables (GFM pipe tables: a header row, or an empty header row when the table has none, a `---` delimiter row, then the rows; cells as inline Markdown with `\|` for a pipe and `<br>` for a line break), code blocks (a ```` ``` ```` fence with the language, the text verbatim, and a closing fence longer than any run of backticks inside), callouts (GitHub alert syntax: `> [!NOTE]`, `[!TIP]`, `[!IMPORTANT]`, `[!WARNING]` or `[!CAUTION]` for the tones default, success, info, warning and error, then the emoji and the text, children indented), marks (`**bold**`, `*italic*`, `~~strikethrough~~`, `` `code` ``, `<u>underline</u>`, `[text](url)`), and mentions (`@[Title](page:id)` or `@[Title](task:id)`, where the bracket text is the mention's label when it differs from the target's current title, otherwise the target's current title). A pending suggestion SHALL be read as a line `<suggestion id="…" by="…" action="…" status="…">` (with `target="…"` for replace and delete, and `note="…"` when it has one), its proposed blocks, and a line `</suggestion>`. Markdown written by agents SHALL be stored as the same blocks and marks (toggles and references excepted); in tables, rows SHALL be padded or cut to the header row's width and alignment markers ignored; a callout without an emoji SHALL get its tone's default emoji; text inside code fences SHALL be stored verbatim; `@[Title](task:id)` and `@[Title](page:id)` SHALL become mentions when the target exists and plain text otherwise, keeping the bracket text as the mention's label when it differs from the target's current title. A trailing block anchor (` ^` and 8 hexadecimal characters) at the end of a line SHALL be dropped, and Markdown containing a `<suggestion` line SHALL be refused with status 422 (code `validation`).

#### Scenario: Round trip
- **WHEN** an agent comments "Fixed in **two** places:\n\n- [x] parser\n- [ ] see @[Add login](task:1a2b3c4d)"
- **THEN** the comment has a paragraph with a bold span, a checked todo and an unchecked todo containing a mention of that task, and reading it back gives the same Markdown

#### Scenario: A mention keeps a differing label
- **WHEN** an agent writes "see @[login](task:1a2b3c4d)" where that task's title is "Add login"
- **THEN** the mention carries the label "login", is shown as "login", and reading it back gives "@[login](task:1a2b3c4d)"; a mention whose bracket text already equals the current title reads back with that title and no stored label

#### Scenario: Another agent's suggestion is visible
- **WHEN** "reviewer" reads a page on which "builder" has a pending insert suggestion with the note "Add tables"
- **THEN** the Markdown contains `<suggestion id="…" by="builder" action="insert" status="pending" note="Add tables">`, the proposed blocks, and `</suggestion>`, where the suggestion is

#### Scenario: A table round trip
- **WHEN** an agent creates a page with "| Subtopic | Rating |\n|---|---|\n| DNS | 🟡 **Shaky** |"
- **THEN** the page has a table with a header row and one row of two cells, the second cell's "Shaky" bold, and reading the page gives the same Markdown

#### Scenario: Code and callout round trip
- **WHEN** an agent writes "```sh\nstrace -f ./server\n```\n\n> [!WARNING] ⚠️ Don't load a movement that scored 0"
- **THEN** the page has a code block with language "sh" holding that line and a warning callout with the emoji ⚠️, and reading it gives the same Markdown
