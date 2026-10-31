## ADDED Requirements

### Requirement: Findings on the exploration page
Exploration pages SHALL show the exploration's findings oldest first, each with its author ("You" or the agent's name), its time, an "Edited" marker once it has been edited, and its content rendered like page content. Each finding SHALL be addressable at `#finding-<id>`. The page SHALL offer writing a new finding with the same editor as comments, saved with an "Add finding" button or Cmd/Ctrl+Enter; nothing SHALL be saved until then, and an empty finding SHALL be rejected. Each finding, whoever wrote it, SHALL offer editing in place as comments do, and deleting after a confirmation. Its todos SHALL be checkable without editing it, and its toggles SHALL open and close. With no findings, the tab SHALL say so.

#### Scenario: Add a finding
- **WHEN** a finding "Tables are used on 16 of 20 pages" is written on an exploration and "Add finding" is pressed
- **THEN** the exploration's findings end with that finding by "You", and the editor is empty again

#### Scenario: Empty finding
- **WHEN** an empty finding is added
- **THEN** no finding is added and the editor shows that the finding is empty

#### Scenario: Delete an agent's finding
- **WHEN** a finding by agent "builder" is deleted and the deletion is confirmed
- **THEN** it is no longer listed

## MODIFIED Requirements

### Requirement: Task page tabs
Below the task's header (title, kind and state, chore urgency and schedule, and the transitions and start actions), the task page SHALL show its sections as tabs, with the description in the first tab:

| Kind | Tabs |
|---|---|
| Work | Description · Comments · Lineage · References · History |
| Chore | Description · Comments · References · History |
| Exploration | Description · Findings · Lineage · References · History |
| Update | Description · Lineage · References · History |

The Comments, Findings and References tabs SHALL show how many items they hold (References counting what the task references and what mentions or references it). The References tab SHALL list both what the task references and where it is mentioned. The open tab SHALL be part of the URL (`?tab=`), defaulting to Description, so a reload or a shared link opens the same tab. A link to a comment (`#comment-<id>`) SHALL open the Comments tab and show that comment, and a link to a finding (`#finding-<id>`) SHALL open the Findings tab and show that finding. Every tab SHALL be shown even when empty, with its empty state. The header's actions SHALL work from every tab.

#### Scenario: Comments tab
- **WHEN** a work task with 2 comments is opened and the "Comments (2)" tab is chosen
- **THEN** the URL has `?tab=comments`, the comments are shown, the description is not, and reloading keeps the Comments tab

#### Scenario: Link to a comment
- **WHEN** `/tasks/W#comment-c1` is opened
- **THEN** the Comments tab is open and comment c1 is in view

#### Scenario: Chore tabs
- **WHEN** a chore is opened
- **THEN** its tabs are Description, Comments, References and History, and its schedule is in the header

#### Scenario: Exploration tabs
- **WHEN** an exploration with 3 findings is opened
- **THEN** its tabs are Description, Findings (3), Lineage, References and History

#### Scenario: Link to a finding
- **WHEN** `/tasks/E#finding-f1` is opened
- **THEN** the Findings tab is open and finding f1 is in view

### Requirement: Deleting a task
The task page SHALL show a delete button at the top right for a task of any kind, in any state. It SHALL open a confirmation dialog naming the task and saying how many comments or findings go with it; only confirming SHALL delete. Deleting SHALL remove the task with its body page, comments, findings, history and the relations from it, in one unit of work, and the browser SHALL go to the project's list for the task's kind. References, mentions and lineage pointing to the deleted task SHALL resolve as missing.

#### Scenario: Delete an exploration
- **WHEN** the delete button of an exploration is pressed and the deletion confirmed
- **THEN** the exploration no longer exists and the browser is on the project's explorations list

#### Scenario: Reference to a deleted task
- **WHEN** a task references another task that is then deleted
- **THEN** the reference shows as missing
