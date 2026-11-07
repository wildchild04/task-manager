## MODIFIED Requirements

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


## ADDED Requirements

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
