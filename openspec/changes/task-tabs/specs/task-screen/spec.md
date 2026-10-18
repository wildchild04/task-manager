## MODIFIED Requirements

### Requirement: Chore urgency from the task page
A chore in `todo` SHALL show its urgency as a dropdown (Normal, Urgent) in its header; choosing a value SHALL save it at once. Changing it SHALL change only this occurrence's urgency; the base urgency and schedule SHALL stay as configured. A chore that is done or cancelled SHALL show its urgency without the dropdown.

#### Scenario: Mark urgent
- **WHEN** "Urgent" is chosen in the urgency dropdown of a normal weekly chore
- **THEN** the chore shows as urgent, and completing it creates a following chore with normal urgency

## ADDED Requirements

### Requirement: Task page tabs
Below the task's header (title, kind and state, chore urgency and schedule, and the transitions and start actions), the task page SHALL show its sections as tabs, with the description in the first tab:

| Kind | Tabs |
|---|---|
| Work | Description · Comments · Lineage · References · History |
| Chore | Description · Comments · References · History |
| Exploration, update | Description · Lineage · References · History |

Comments and References tabs SHALL show how many items they hold (References counting what the task references and what mentions or references it). The References tab SHALL list both what the task references and where it is mentioned. The open tab SHALL be part of the URL (`?tab=`), defaulting to Description, so a reload or a shared link opens the same tab; a link to a comment (`#comment-<id>`) SHALL open the Comments tab and show that comment. Every tab SHALL be shown even when empty, with its empty state. The header's actions SHALL work from every tab.

#### Scenario: Comments tab
- **WHEN** a work task with 2 comments is opened and the "Comments (2)" tab is chosen
- **THEN** the URL has `?tab=comments`, the comments are shown, the description is not, and reloading keeps the Comments tab

#### Scenario: Link to a comment
- **WHEN** `/tasks/W#comment-c1` is opened
- **THEN** the Comments tab is open and comment c1 is in view

#### Scenario: Chore tabs
- **WHEN** a chore is opened
- **THEN** its tabs are Description, Comments, References and History, and its schedule is in the header

### Requirement: Editing a chore's schedule
Clicking a chore's schedule chip, while the chore is in to do, SHALL open a dialog with every schedule option (no schedule, at a time, on a date, daily/weekly/monthly at a time, every X, timer), prefilled with the current schedule. Saving SHALL change the chore's configured schedule (carried to its following chores) and recompute its due time from now; invalid input SHALL be shown next to its field without losing what was entered.

#### Scenario: Change to weekly
- **WHEN** a chore without a schedule is given "weekly on Monday at 09:00" from its schedule chip
- **THEN** the chip shows "Every Monday at 09:00" with the next Monday's due time, and completing the chore creates a following chore due the Monday after

#### Scenario: Invalid time
- **WHEN** the schedule dialog is saved with time "25:00"
- **THEN** the schedule is unchanged and the dialog shows the time error
