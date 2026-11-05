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
| `GET task/:id/description` | `maxChars?`, `offset?`, `anchors?` | `{ markdown, more, offset? }` |
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
| `GET page/:id` | `maxChars?`, `offset?`, `anchors?` | `{ title, markdown, more, offset? }` |
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
