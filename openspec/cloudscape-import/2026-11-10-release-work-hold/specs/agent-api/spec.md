## MODIFIED Requirements

### Requirement: Agent permissions and claiming

Agents SHALL be able to read projects, tasks, descriptions, comments, references, pages and suggestions; create tasks of any kind in existing projects; create pages; suggest changes to any page or task description and withdraw their own suggestions; apply `start`, `pause`, `complete` and `return` to work tasks; comment on any task (of any kind); read any task's history; and append to a work task's description. On tickets, agents SHALL be able to apply `triage`, `block` and `unblock`, comment, append to the description, and update steps; and they SHALL be able to get or create the shift for a date. On experiments, agents SHALL be able to apply `start` and `shelve`, comment and append to the description (experiments have no steps); learning, dropping, promoting and reviving an experiment SHALL be refused with code `forbidden`. Resolving and handing off a ticket SHALL be refused with code `forbidden`. Approving or rejecting a suggestion, and any other change, SHALL be refused with status 403 (code `forbidden`). A work task an agent started SHALL be held by that agent while it is in progress, until the human releases it: `pause`, `complete`, `return`, comments and description additions by another agent SHALL be refused with status 409 (code `claimed`, naming the holder); suggestions on its description SHALL be allowed. An in-progress work task nobody holds (released, or started by the human) SHALL list `start` in `get_task`'s `transitions`, and an agent's `start` on it SHALL keep it in progress and make that agent its holder; `start` on a task another agent holds SHALL be refused with code `invalid_transition`. Agents SHALL NOT release a hold. Transitions not allowed from the current state SHALL be refused with status 409 (code `invalid_transition`).

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

- **WHEN** an agent starts an experiment and comments "Cold start: 310 ms"
- **THEN** the experiment is running, with that comment by the agent

#### Scenario: Cancel is refused

- **WHEN** an agent tries to cancel a work task
- **THEN** it is refused with code `forbidden` and the task is unchanged

#### Scenario: Claimed by another agent

- **WHEN** "builder" started a work task and "reviewer" tries to complete it
- **THEN** it is refused with code `claimed` naming "builder", and the task stays in progress

#### Scenario: Taking over released work

- **WHEN** "builder" started a work task, the human releases it, and "reviewer" applies `start`
- **THEN** the task stays in progress, `get_task` shows `heldBy` "reviewer", and a comment by "builder" is refused with code `claimed` naming "reviewer"

#### Scenario: Return with a reason

- **WHEN** "builder" returns the work task it started with the reason "Missing API key"
- **THEN** the task is back in to do, its comments end with "Missing API key" by "builder", and another agent can start it

#### Scenario: Suggesting on held work

- **WHEN** "builder" holds a work task and "reviewer" suggests inserting a paragraph into its description
- **THEN** the suggestion is created and pending

#### Scenario: Comment on an exploration

- **WHEN** an agent comments "Worth a spike" on an open exploration
- **THEN** the comment is created by the agent and the exploration is unchanged

#### Scenario: No steps on experiments

- **WHEN** an agent lists or updates an experiment's steps
- **THEN** it is refused with code `validation`, and adding one (`POST task/:id/steps`) is not a function (`not_found`)
