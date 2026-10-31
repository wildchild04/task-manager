## MODIFIED Requirements

### Requirement: Agent permissions and claiming
Agents SHALL be able to read projects, tasks, descriptions, comments, references, pages and suggestions; create tasks of any kind in existing projects; create pages; suggest changes to any page or task description and withdraw their own suggestions; apply any transition a task's kind allows from its state (promoting an exploration or update into work, tombstoning and reviving ideas, every work transition, completing and cancelling chores); comment on work tasks; append to a work task's description; add findings to explorations in any state, and edit and delete their own findings. Approving or rejecting a suggestion, editing or deleting another author's finding, and any other change, SHALL be refused with status 403 (code `forbidden`). A work task an agent started SHALL be held by that agent while it is in progress: its transitions, comments and description additions by another agent SHALL be refused with status 409 (code `claimed`, naming the holder); suggestions on its description SHALL be allowed. Transitions not allowed from the current state SHALL be refused with status 409 (code `invalid_transition`).

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

### Requirement: Agent functions
The API SHALL offer exactly these functions, each returning only the listed fields. Functions that take Markdown (`POST tasks` `description`, `POST task/:id/comment`, `POST task/:id/finding`, `POST finding/:id`, `POST task/:id/description`, `POST pages`, `POST suggest`) SHALL also return `warnings` when the Markdown held unsupported constructs (see Markdown guide and warnings), and only then:

| Function | Request | Response |
|---|---|---|
| `GET projects` | | `{ projects: [{ id, title }] }` |
| `GET tasks` | `project?`, `kind?`, `state?`, `query?` (title contains), `limit?`, `cursor?` | `{ tasks: [{ id, kind, state, title }], more, cursor? }`, most recently updated first |
| `POST tasks` | `{ project, kind, title, description?, urgency?, schedule?, iteratesOn? }` | `{ ok: true, id, state }` |
| `GET task/:id` | | `{ id, kind, state, title, project, heldBy?, transitions, counts: { comments, references, findings? } }` (`transitions`: those this agent may apply now; `findings` for explorations only) |
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
| `GET suggestion/:id` | | `{ id, action, status, place, resolvedAt? }` (`place`: `page:<id>` or `task:<id>`) |
| `POST suggestion/:id/withdraw` | | `{ ok: true }` |
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
