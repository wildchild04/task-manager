## ADDED Requirements

### Requirement: Images in Markdown
A line that is only `![alt](src)` SHALL become an image block: a `src` naming an uploaded item (a `/content/<id>` URL, relative or absolute) SHALL become that item, and another `http:` or `https:` URL SHALL become an external image. Image blocks SHALL be written as `![alt](url)` on a line of their own, an uploaded item's URL absolute (with the app's origin and base path). Copying from the editor and pasting HTML (`<img src alt>`) SHALL follow the same rules.

#### Scenario: An agent adds a chart by URL
- **WHEN** an agent appends Markdown with the line `![Latency p95](https://grafana.example/render/p95.png)`
- **THEN** the page gets an image block with that URL and alt text, and the answer has no `warnings`

#### Scenario: Reading an uploaded image
- **WHEN** an agent reads a page holding an uploaded screenshot with alt text "Error dialog"
- **THEN** the Markdown has `![Error dialog](https://<host>/task-manager/content/<id>.png)` on its own line

## MODIFIED Requirements

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
