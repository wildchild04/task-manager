## MODIFIED Requirements

### Requirement: Agent permissions and claiming
Agents SHALL be able to read projects, tasks, descriptions, comments, references and pages; create tasks of any kind in existing projects; apply `start`, `pause`, `complete` and `return` to work tasks; comment on work tasks; and append to a work task's description. Any other change SHALL be refused with status 403 (code `forbidden`). A work task an agent started SHALL be held by that agent while it is in progress: `pause`, `complete`, `return`, comments and description additions by another agent SHALL be refused with status 409 (code `claimed`, naming the holder). Transitions not allowed from the current state SHALL be refused with status 409 (code `invalid_transition`).

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
| `GET page/:id` | `maxChars?`, `offset?` | `{ title, markdown, more, offset? }` |

#### Scenario: A work loop
- **WHEN** an agent lists to-do work, gets one task, reads its description, starts it, comments and completes it
- **THEN** each call returns only its listed fields, and the task's history and comments show the agent's name

## ADDED Requirements

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
