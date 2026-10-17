# task-screen Specification

## Purpose
TBD - created by archiving change task-ui. Update Purpose after archive.
## Requirements
### Requirement: Transitions from the task page
The task page SHALL offer exactly the transitions of the task's kind that are allowed from its current state, each labelled in words (for example "Start", "Promote to work", "Return…", "Tombstone"). Applying one SHALL record it in the task's history with the human as the actor, and the page SHALL then show the new state and the transitions allowed from it. A transition the domain rejects SHALL show the domain's message and leave the task unchanged.

#### Scenario: Only allowed transitions
- **WHEN** the page of a work task in `in_progress` is opened
- **THEN** it offers pause, return, complete and cancel, and not start or reopen

#### Scenario: Start work
- **WHEN** "Start" is applied to a work task in `todo`
- **THEN** the task is `in_progress` and its history shows the start by the human

#### Scenario: Revive a tombstoned idea
- **WHEN** "Revive" is applied to a tombstoned exploration
- **THEN** the exploration is `open` and offers promote and tombstone again

### Requirement: Promote opens the new work
Promoting an exploration or an update SHALL ask for the new work's title, prefilled with the idea's title, and SHALL reject an empty title. On success the browser SHALL open the new work task, which is born from the idea.

#### Scenario: Promote an exploration
- **WHEN** the exploration "Passkeys" is promoted with the title "Add passkey login"
- **THEN** the browser is on the new work task "Add passkey login", and the exploration is `promoted`

#### Scenario: Empty title
- **WHEN** a promotion is submitted with an empty title
- **THEN** nothing changes and the dialog shows that a title is required

### Requirement: Returning work
Returning work SHALL ask for a reason (required) and optional text to add to the task's description. The reason SHALL be posted as a comment by the human and recorded as the history note; each paragraph of the optional text SHALL be appended to the end of the task's body page as a paragraph block. The work SHALL go back to `todo`.

#### Scenario: Return with a reason and a description note
- **WHEN** an in-progress work task is returned with the reason "Blocked on the API key" and the text "Needs the staging key first."
- **THEN** the task is `todo`, its comments end with "Blocked on the API key", its history shows the return with that note, and its body ends with the paragraph "Needs the staging key first."

#### Scenario: Reason required
- **WHEN** a return is submitted without a reason
- **THEN** the task stays `in_progress` and the dialog shows that a reason is required

### Requirement: Completing and cancelling chores
Completing a chore SHALL ask "Create the following chore with the same configuration?", answered yes by default when the chore repeats and no otherwise; the question SHALL not be offered for a chore due on a specific date. Cancelling a repeating chore SHALL ask whether to cancel this occurrence (the next one is created) or the whole series; cancelling a chore that doesn't repeat SHALL cancel it directly.

#### Scenario: Complete a repeating chore
- **WHEN** a weekly chore is completed with the default answer
- **THEN** it is `done` and a following chore of the same series is due the next week

#### Scenario: Complete without a follower
- **WHEN** a weekly chore is completed answering no
- **THEN** it is `done` and no following chore is created

#### Scenario: Cancel the series
- **WHEN** a daily chore is cancelled choosing "the whole series"
- **THEN** it is `cancelled` and no following chore is created

### Requirement: Chore urgency from the task page
A chore in `todo` SHALL offer "Mark urgent" when its urgency is normal and "Mark normal" when it is urgent. Changing it SHALL change only this occurrence's urgency; the base urgency and schedule SHALL stay as configured.

#### Scenario: Mark urgent
- **WHEN** "Mark urgent" is applied to a normal weekly chore
- **THEN** the chore shows as urgent, and completing it creates a following chore with normal urgency

### Requirement: Task history
The task page SHALL list the task's applied transitions, newest first, each with the transition, the states it went from and to, the actor ("You" for the human, the agent's name for an agent), the note when there is one, and the time in the workspace time zone.

#### Scenario: Agent return in history
- **WHEN** the agent "builder" returned a work task with the reason "Tests fail on CI"
- **THEN** the history shows a return by "builder" from in progress to to do, with the note "Tests fail on CI"

### Requirement: Comments on the task page
Work and chore pages SHALL show the task's comments oldest first, each with its author ("You" or the agent's name), its time, an "Edited" marker once edited, and its content rendered like page content. Each comment SHALL be addressable at `#comment-<id>`. The page SHALL offer adding a comment as plain text, where each paragraph (text separated by a blank line) becomes a paragraph block; an empty comment SHALL be rejected. Each comment SHALL offer editing, which replaces its content with the new text's paragraphs and marks it edited, and deleting after a confirmation. Exploration and update pages SHALL not show comments.

#### Scenario: Add a comment
- **WHEN** the comment "First line\n\nSecond paragraph" is added to a work task
- **THEN** the work task's comments end with a comment by "You" with two paragraphs, "First line" and "Second paragraph"

#### Scenario: Empty comment
- **WHEN** an empty comment is submitted
- **THEN** no comment is added and the form shows that the comment is empty

#### Scenario: Edit a comment
- **WHEN** a comment is edited to "Updated text"
- **THEN** its content is the single paragraph "Updated text" and it shows as edited

#### Scenario: Delete a comment
- **WHEN** a comment is deleted and the deletion confirmed
- **THEN** it is no longer listed

#### Scenario: Explorations have no comments
- **WHEN** an exploration's page is opened
- **THEN** it shows no comments section

### Requirement: Lineage on the task page
Exploration, work and update pages SHALL show the feature's lineage as a tree: from the root exploration (or the first work, when there is none) through every work born from an idea and every update iterating on work. Each entry SHALL show the task's kind, title and state; the current task SHALL be marked and every other entry SHALL link to its task page. A task alone in its lineage SHALL show no lineage. Chore pages SHALL show no lineage.

#### Scenario: Lineage from the middle
- **WHEN** an exploration was promoted to work, the work is done and an update iterates on it, and the work's page is opened
- **THEN** the lineage shows the exploration, the work nested under it marked as current, and the update nested under the work, with the exploration and update linking to their pages

### Requirement: References on the task page
The task page SHALL list what the task references, each with its kind and title and a link: a task to its page; a comment to its task page at `#comment-<id>`; a block to the page that contains it (the task page for a block in a task's body or a comment). A reference whose target was deleted SHALL show as missing. The page SHALL offer adding a reference to another task of the same project (not itself, not one already referenced) and removing any reference. Lineage relations SHALL not be listed as references and cannot be removed. The page SHALL also list "Referenced by": the tasks that reference this task, linked.

#### Scenario: Add and remove a reference
- **WHEN** a work task adds a reference to the exploration "Passkeys" and later removes it
- **THEN** "Passkeys" is listed under the work's references, and the exploration lists the work under "Referenced by"; after removal neither is listed

#### Scenario: Deleted comment
- **WHEN** a task references a comment that is later deleted
- **THEN** the reference is shown as missing

### Requirement: Starting explorations and updates from anything
Every task page SHALL offer "Start exploration", and every comment SHALL offer "Start exploration from this comment": each asks for a title and creates an open exploration in the same project referencing the task or comment, then opens it. A done work task SHALL also offer "Start update", which asks for a title and creates an open update iterating on it, then opens it. An empty title SHALL be rejected.

#### Scenario: Exploration from a cancelled work task
- **WHEN** "Start exploration" with the title "Rethink sync" is applied on a cancelled work task
- **THEN** the browser is on the new exploration "Rethink sync", whose references list the cancelled work task

#### Scenario: Exploration from a comment
- **WHEN** "Start exploration from this comment" is applied on a comment
- **THEN** the new exploration references that comment, linking back to it on its task page

#### Scenario: Update from done work
- **WHEN** "Start update" with the title "Faster login" is applied on a done work task
- **THEN** the browser is on the new update "Faster login", whose lineage shows it iterating on that work

