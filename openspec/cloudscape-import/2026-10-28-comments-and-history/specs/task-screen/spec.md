## MODIFIED Requirements

### Requirement: Task history
The task page SHALL list the task's history newest first: its applied transitions, each with the transition, the states it went from and to, the actor ("You" for the human, the agent's name for an agent), the note when there is one, and the time in the workspace time zone; its step changes, each with the step's title (and round past round 1), its status from and to, the resolution, the actor and the time; on tickets, diagnostic entries and conclusions marked incorrect and cleared, with the reason, the actor and the time; and every other recorded event of the task-history capability, with its line, the actor, a note where it has one (a comment's first line) and the time. A task created before its creation was recorded SHALL still show "Created" at its creation time.

#### Scenario: Agent return in history
- **WHEN** the agent "builder" returned a work task with the reason "Tests fail on CI"
- **THEN** the history shows a return by "builder" from in progress to to do, with the note "Tests fail on CI"

#### Scenario: Step changes in history
- **WHEN** triage is started on a ticket, "Fetch logs" is completed with "DNS timeouts", and triage is concluded
- **THEN** the history shows, newest first, the conclusion, "Fetch logs" from pending to completed with "DNS timeouts", and the start of triage

#### Scenario: Everything in history
- **WHEN** "planner" creates a chore, the human references a work task from it and marks it urgent, and "planner" comments "Done on staging"
- **THEN** the history shows, newest first, "Commented" by "planner" with the note "Done on staging", "Urgency set to urgent" by "You", "Referenced" with the work's title by "You", and "Created" by "planner"

### Requirement: Task page tabs
Below the task's header (title, kind and state, chore urgency and schedule, and the transitions and start actions), the task page SHALL show its sections as tabs, with the description in the first tab:

| Kind | Tabs |
|---|---|
| Work | Description · Comments · Lineage · References · History |
| Chore | Description · Comments · References · History |
| Exploration, update | Description · Comments · Lineage · References · History |
| Ticket | Description · Diagnostics · Comments · References · History |
| Experiment | Description · Steps · Comments · Lineage · References · History |

Comments and References tabs SHALL show how many items they hold (References counting what the task references and what mentions or references it). The References tab SHALL list both what the task references and where it is mentioned. The open tab SHALL be part of the URL (`?tab=`), defaulting to Description, so a reload or a shared link opens the same tab; a link to a comment (`#comment-<id>`) SHALL open the Comments tab and show that comment. Every tab SHALL be shown even when empty, with its empty state. The header's actions SHALL work from every tab.

#### Scenario: Comments tab
- **WHEN** a work task with 2 comments is opened and the "Comments (2)" tab is chosen
- **THEN** the URL has `?tab=comments`, the comments are shown, the description is not, and reloading keeps the Comments tab

#### Scenario: Link to a comment
- **WHEN** `/tasks/W#comment-c1` is opened
- **THEN** the Comments tab is open and comment c1 is in view

#### Scenario: Experiment tabs
- **WHEN** an experiment with 1 of 2 steps completed is opened
- **THEN** its tabs are Description, Steps (1/2), Comments, Lineage, References and History, and its hypothesis is in the header

#### Scenario: Chore tabs
- **WHEN** a chore is opened
- **THEN** its tabs are Description, Comments, References and History, and its schedule is in the header

## REMOVED Requirements

### Requirement: Comments on the task page
**Reason**: Explorations and updates show comments now.
**Migration**: See "Comments on every task page".

## ADDED Requirements

### Requirement: Comments on every task page
Every task page SHALL show the task's comments oldest first, each with its author ("You" or the agent's name), its time, an "Edited" marker once edited, and its content rendered like page content (including marks, links and mentions). Each comment SHALL be addressable at `#comment-<id>`. The page SHALL offer writing a new comment with the block editor (every block type except pages, marks, links, `@` mentions, the slash menu and markdown shortcuts), posted with a "Comment" button or Cmd/Ctrl+Enter; nothing is saved until it is posted, and an empty comment SHALL be rejected. Each comment SHALL offer editing it in place with the same editor, saving as it is edited and marking it edited, until "Done"; and deleting after a confirmation. The todos of a posted comment SHALL be checkable without editing it, each change saved at once and marking the comment edited, and its toggles SHALL open and close; every block type SHALL look and line up as it does in the editor.

#### Scenario: Add a comment
- **WHEN** a comment with a paragraph "First line" and a bulleted item "Second point" is written and posted on a work task
- **THEN** the work task's comments end with a comment by "You" with that paragraph and that bulleted item, and the new-comment editor is empty again

#### Scenario: Empty comment
- **WHEN** an empty comment is posted
- **THEN** no comment is added and the editor shows that the comment is empty

#### Scenario: Edit a comment
- **WHEN** a comment's text is changed in place to "Updated text" and "Done" is pressed
- **THEN** its content is "Updated text", it shows as edited, and it is read-only again

#### Scenario: Check a todo in a posted comment
- **WHEN** a posted comment's unchecked todo "Done" is clicked
- **THEN** it is checked, still checked after reloading, and the comment shows as edited

#### Scenario: Mention in a comment
- **WHEN** a comment mentioning the document "Architecture" is posted
- **THEN** the comment shows "Architecture" linking to that document

#### Scenario: Delete a comment
- **WHEN** a comment is deleted and the deletion confirmed
- **THEN** it is no longer listed

#### Scenario: Comments on an exploration
- **WHEN** an exploration's page is opened and a comment is posted
- **THEN** its Comments tab shows the comment by "You"

