## MODIFIED Requirements

### Requirement: Agent permissions and claiming
Agents SHALL be able to read projects, tasks, descriptions, comments, references and pages; create tasks of any kind in existing projects; create pages; apply `start`, `pause`, `complete` and `return` to work tasks; comment on work tasks; and append to a work task's description. Any other change SHALL be refused with status 403 (code `forbidden`). A work task an agent started SHALL be held by that agent while it is in progress: `pause`, `complete`, `return`, comments and description additions by another agent SHALL be refused with status 409 (code `claimed`, naming the holder). Transitions not allowed from the current state SHALL be refused with status 409 (code `invalid_transition`).

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
| `POST tasks` | `{ project, kind, title, description?, urgency?, schedule?, iteratesOn? }` | `{ ok: true, id, state }` |
| `GET task/:id` | | `{ id, kind, state, title, project, heldBy?, transitions, counts: { comments, references } }` (`transitions`: those this agent may apply now) |
| `GET task/:id/description` | `maxChars?`, `offset?` | `{ markdown, more, offset? }` |
| `GET task/:id/comments` | `limit?` (default 5), `cursor?`, `maxChars?` (per comment, default 1000) | `{ comments: [{ id, author, markdown }], more, cursor? }`, newest first |
| `GET task/:id/references` | `limit?` | `{ references: [{ kind, id, title }], more }` (missing targets as `{ kind, id, missing: true }`) |
| `POST task/:id/transition` | `{ name, reason? }` | `{ ok: true, state }` |
| `POST task/:id/comment` | `{ markdown }` | `{ ok: true, id }` |
| `POST task/:id/description` | `{ markdown }` (appended) | `{ ok: true }` |
| `GET pages` | `query`, `limit?` | `{ pages: [{ id, title, place }], more }` |
| `POST pages` | `{ title, project?, parent?, markdown? }` | `{ ok: true, id }` |
| `GET page/:id` | `maxChars?`, `offset?` | `{ title, markdown, more, offset? }` |

#### Scenario: A work loop
- **WHEN** an agent lists to-do work, gets one task, reads its description, starts it, comments and completes it
- **THEN** each call returns only its listed fields, and the task's history and comments show the agent's name

## ADDED Requirements

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
