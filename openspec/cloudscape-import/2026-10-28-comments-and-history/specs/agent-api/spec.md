## MODIFIED Requirements

### Requirement: Agent permissions and claiming
Agents SHALL be able to read projects, tasks, descriptions, comments, references, pages and suggestions; create tasks of any kind in existing projects; create pages; suggest changes to any page or task description and withdraw their own suggestions; apply `start`, `pause`, `complete` and `return` to work tasks; comment on any task (of any kind); read any task's history; and append to a work task's description. On tickets, agents SHALL be able to apply `triage`, `block` and `unblock`, comment, append to the description, and add and update steps; and they SHALL be able to get or create the shift for a date. On experiments, agents SHALL be able to apply `start` and `shelve`, comment, append to the description, and add and update steps; learning, dropping, promoting and reviving an experiment SHALL be refused with code `forbidden`. Resolving and handing off a ticket SHALL be refused with code `forbidden`. Approving or rejecting a suggestion, and any other change, SHALL be refused with status 403 (code `forbidden`). A work task an agent started SHALL be held by that agent while it is in progress: `pause`, `complete`, `return`, comments and description additions by another agent SHALL be refused with status 409 (code `claimed`, naming the holder); suggestions on its description SHALL be allowed. Transitions not allowed from the current state SHALL be refused with status 409 (code `invalid_transition`).

#### Scenario: Accepting triage is human
- **WHEN** an agent concludes triage on a ticket and then tries to accept it
- **THEN** the conclusion is recorded, accepting is refused with code `forbidden`, and the ticket is triaged

#### Scenario: Closing a ticket is human
- **WHEN** an agent tries to delegate, verify or dismiss a ticket
- **THEN** it is refused with code `forbidden` and the ticket is unchanged

#### Scenario: Learning is human
- **WHEN** an agent tries to learn or promote an experiment
- **THEN** it is refused with code `forbidden` and the experiment is unchanged

#### Scenario: Agent runs an experiment
- **WHEN** an agent starts an experiment, adds step "Benchmark cold start" and comments with its numbers
- **THEN** the experiment is running, with that step and comment

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

#### Scenario: Comment on an exploration
- **WHEN** an agent comments "Worth a spike" on an open exploration
- **THEN** the comment is created by the agent and the exploration is unchanged

### Requirement: Agent functions
The API SHALL offer exactly these functions, each returning only the listed fields:

| Function | Request | Response |
|---|---|---|
| `GET projects` | | `{ projects: [{ id, title, mode, parent? }] }` (`mode`: the mode ID; `parent`: a sub-project's container) |
| `GET tasks` | `project?`, `kind?`, `state?`, `query?` (title contains), `ticketId?` (exact, ignoring case), `limit?`, `cursor?` | `{ tasks: [{ id, kind, state, title }], more, cursor? }`, most recently updated first |
| `POST tasks` | `{ project, kind, title, description?, urgency?, schedule?, iteratesOn?, ticketId?, url?, severity? }` | `{ ok: true, id, state }` |
| `GET task/:id` | | `{ id, kind, state, title, project, heldBy?, ticketId?, hypothesis?, triage?, transitions, suggestable?, suggestion?, counts: { comments, references, steps?, diagnostics? } }` (`transitions`: those this agent may apply now; `suggestable`: those it may suggest now, when any; `suggestion`: the pending state suggestion as `{ id, transition, by }`) |
| `GET task/:id/description` | `maxChars?`, `offset?`, `anchors?` | `{ markdown, more, offset? }` |
| `GET task/:id/comments` | `limit?` (default 5), `cursor?`, `maxChars?` (per comment, default 1000) | `{ comments: [{ id, author, markdown }], more, cursor? }`, newest first |
| `GET task/:id/history` | `limit?` (default 10), `cursor?` | `{ entries: [{ id, type, label, from?, to?, actor?, note?, at }], more, cursor? }`, newest first (`type`: `transition`, `step`, `flag` or `event`; `actor`: `human` or an agent's name; `at`: ISO) |
| `GET task/:id/references` | `limit?` | `{ references: [{ kind, id, title }], more }` (missing targets as `{ kind, id, missing: true }`) |
| `POST task/:id/transition` | `{ name, reason?, note? }` | `{ ok: true, state }` |
| `GET task/:id/steps` | | `{ steps: [{ index, title, status, description?, resolution? }] }` |
| `POST task/:id/steps` | `{ title, description? }` (appended) | `{ ok: true, index }` |
| `POST task/:id/step/:index` | `{ status?, resolution?, title?, description? }` | `{ ok: true }` |
| `POST shifts` | `{ date? }` (YYYY-MM-DD, default today) | `{ ok: true, id, title, created }` |
| `POST task/:id/comment` | `{ markdown }` | `{ ok: true, id }` |
| `GET task/:id/diagnostics` | `stage?`, `kind?`, `limit?` (default 5), `cursor?`, `maxChars?` (per entry, default 1000) | `{ entries: [{ id, author, stage, round, kind?, incorrect?: { reason, stage }, markdown }], more, cursor? }`, newest first |
| `POST task/:id/diagnostics` | `{ markdown, kind? }` | `{ ok: true, id, stage }` |
| `POST diagnostic/:id` | `{ markdown }` (replaces the body) | `{ ok: true }` |
| `POST diagnostic/:id/incorrect` | `{ reason }` | `{ ok: true }` |
| `DELETE diagnostic/:id/incorrect` | | `{ ok: true }` |
| `POST task/:id/description` | `{ markdown }` (appended) | `{ ok: true }` |
| `GET pages` | `query`, `limit?` | `{ pages: [{ id, title, place }], more }` |
| `POST pages` | `{ title, project?, parent?, markdown? }` | `{ ok: true, id }` |
| `GET page/:id` | `maxChars?`, `offset?`, `anchors?` | `{ title, markdown, more, offset? }` |
| `GET project/:id/description` | `maxChars?`, `offset?`, `anchors?` | `{ title, markdown, more, offset? }` |
| `POST suggest` | `{ page?, task?, project?, action, after?, inside?, target?, markdown?, note? }` | `{ ok: true, id }` |
| `POST task/:id/transition-suggestion` | `{ name, note?, title?, next?, scope? }` | `{ ok: true, id }` |
| `GET suggestion/:id` | | `{ id, action, transition?, status, place, resolvedAt? }` (`place`: `page:<id>`, `task:<id>` or `project:<id>`; a state suggestion has `action: "transition"` and its `transition`) |
| `POST suggestion/:id/withdraw` | | `{ ok: true }` |

#### Scenario: Projects with their modes
- **WHEN** an agent lists projects with Personal container "Garden" and sub-project "Editor" of Project work container "Taskhub"
- **THEN** it gets "Garden" with mode `personal`, "Taskhub" with mode `project`, and "Editor" with mode `project` and parent Taskhub's ID

#### Scenario: A work loop
- **WHEN** an agent lists to-do work, gets one task, reads its description, starts it, comments and completes it
- **THEN** each call returns only its listed fields, and the task's history and comments show the agent's name
