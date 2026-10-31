## ADDED Requirements

### Requirement: Action suggestions
An action suggestion SHALL be an agent's proposal to act on a subject (a project, page or task) rather than to change blocks. Its action SHALL be one of:
- **rename** a project, page or task, to a non-empty plain-text title (a project's title is its home page's, a task's its body page's);
- **delete** a project, a page that page-deletion allows deleting, or a task;
- **schedule**: give a chore in to do a new schedule (any `chore-scheduling` schedule type) or remove its schedule;
- **transition**: an ending transition allowed from the task's current state — `cancel` of work, `tombstone` of an exploration or update, or `cancel` of a chore with scope `series`.

A suggestion that names a subject of the wrong kind, another transition, a transition not allowed from the current state, an invalid schedule, a schedule for a task that isn't a chore in to do, an empty title, or a page that can't be deleted SHALL be refused, and nothing SHALL be created. A missing subject SHALL be refused as not found.

#### Scenario: Suggest renaming a page
- **WHEN** "claude" suggests renaming the page "Roadmap" to "Roadmap 2027"
- **THEN** a pending suggestion by "claude" exists, and the page is still titled "Roadmap"

#### Scenario: Non-ending transition
- **WHEN** an agent suggests the transition `start` on a work task
- **THEN** it is refused and nothing is created

#### Scenario: Schedule on work
- **WHEN** an agent suggests a schedule for a work task
- **THEN** it is refused and nothing is created

### Requirement: Action suggestion record and status
An action suggestion SHALL be recorded like any suggestion (author, action, optional note of at most 280 characters, when it was made, status `pending`, `approved`, `rejected` or `withdrawn`, when it was resolved), with its subject and what it proposes. A pending action suggestion SHALL be reported as `outdated` when its subject no longer exists, or when the subject changed in what the suggestion depends on: for rename, the subject's title; for schedule, the chore's state or configured schedule; for transition, the task's state. Withdrawing SHALL work as for block suggestions: only by its author, while pending or outdated.

#### Scenario: Competing renames
- **WHEN** "planner" and "builder" each suggest a new title for the task "Login", and the human approves the one by "planner"
- **THEN** the suggestion by "builder" is `outdated`

#### Scenario: Subject deleted
- **WHEN** an agent suggested renaming a page, and the human then deletes the page
- **THEN** the suggestion is `outdated` and is no longer listed as waiting for review

#### Scenario: Withdraw own action suggestion
- **WHEN** "claude" withdraws its pending suggestion to delete a task
- **THEN** its record is `withdrawn` and the task is unchanged

### Requirement: Approving and rejecting an action suggestion
Approving a pending action suggestion that isn't outdated SHALL apply the action as the human's own control would, in one unit of work with setting its record to `approved`: renaming sets the title; deleting removes the project, page or task with everything the human's delete removes; schedule changes the chore's schedule as editing it would; a transition is applied with the human as the actor. If the action is refused when applied, nothing SHALL change and the refusal's message SHALL be shown. Approving an outdated suggestion SHALL be refused. Rejecting a pending or outdated action suggestion SHALL set its record to `rejected` and change nothing else. Only humans SHALL approve or reject. Approving or rejecting an action suggestion SHALL offer no Undo.

#### Scenario: Approve a schedule
- **WHEN** the human approves a suggestion to schedule the chore "Back up" weekly on Monday at 09:00
- **THEN** the chore's schedule is "Every Monday at 09:00", its due time is the next Monday at 09:00, and the record is `approved`

#### Scenario: Approve a cancel
- **WHEN** the human approves "builder"'s suggestion to cancel the work "Old migration"
- **THEN** the work is `cancelled` and its history shows the cancel by the human

#### Scenario: Reject a delete
- **WHEN** the human rejects a suggestion to delete the project "Garden"
- **THEN** "Garden" still exists with everything in it, and the record is `rejected`

#### Scenario: Outdated rename
- **WHEN** the human renames a page after an agent suggested another title, then tries to approve the suggestion
- **THEN** it is refused and the page keeps the human's title

### Requirement: Action suggestions at their control
A pending action suggestion SHALL be shown next to the control a human uses for that action, as a highlighted (yellow) bar naming the agent and the action in words ("suggests renaming this page to "…"", "suggests deleting this page", "suggests changing the schedule to Every Monday at 09:00", "suggests cancelling this work"), with its note, "Outdated" when it is, and **Approve** (not shown when outdated) and **Reject**:

| Screen | Rename | Delete | Schedule | Transition |
|---|---|---|---|---|
| Project home | under the title | by the delete button | – | – |
| Page | under the title | by the delete button | – | – |
| Task page | under the title | by the delete button | under the actions row (which holds the schedule button) | under the actions row |

Several pending suggestions for the same control SHALL be shown oldest first. Approving a delete SHALL first open the same confirmation dialog as the delete button, saying what goes with it; only confirming SHALL approve, and the browser SHALL then go where the delete button would have taken it. After a decision the bar SHALL disappear and the screen SHALL show the result.

#### Scenario: Delete suggested on a page
- **WHEN** "claude" suggests deleting the page "Scratch", which has one page inside, and the page is opened
- **THEN** a bar by the delete button reads "claude suggests deleting this page", with Approve and Reject

#### Scenario: Approve a page deletion
- **WHEN** Approve is chosen on that bar and the dialog saying 1 page inside will be deleted too is confirmed
- **THEN** "Scratch" and the page inside it are gone, and the browser is on the page's parent

#### Scenario: Transition under the actions row
- **WHEN** an agent suggests tombstoning an open exploration, and the exploration is opened
- **THEN** the bar "… suggests tombstoning this exploration" shows right under its actions row
