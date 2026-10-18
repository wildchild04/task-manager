## MODIFIED Requirements

### Requirement: Creating tasks
Each task list SHALL offer creating a task of its kind in its initial state, with a server-generated ID:
- **explorations and work:** a quick-add row with the title; while it holds text, the list SHALL show only the tasks whose title contains that text (ignoring case and surrounding spaces), saying when none match, and creating the task SHALL clear the row and the filter
- **updates:** a dialog with the title and the done work task it iterates on, chosen from the project's done work; if the project has no done work, the dialog SHALL say so and creation SHALL be unavailable
- **chores:** a dialog with the title, urgency (normal or urgent), and an optional schedule of any of the five types with that type's fields

Rejected input (for example an empty title, an invalid time or a missing field) SHALL be shown next to the form without losing what was entered. A created task SHALL appear in the list.

#### Scenario: Quick-add work
- **WHEN** "Add login" is entered in the work list's quick-add row
- **THEN** a work task "Add login" in `todo` appears in the list

#### Scenario: Quick-add filters the list
- **WHEN** "sign" is typed in the work list's quick-add row, with work "Sign in with OAuth" and "Search"
- **THEN** only "Sign in with OAuth" is listed, and after pressing Enter a work task "sign" is created and the whole list shows again

#### Scenario: Update needs done work
- **WHEN** the update dialog is opened in a project with no done work
- **THEN** it explains that an update iterates on done work and creation is unavailable

#### Scenario: Scheduled chore
- **WHEN** a chore "Water plants" is created with a weekly schedule on Monday at 09:00
- **THEN** it appears in the chores list with its next Monday 09:00 due time

#### Scenario: Invalid time
- **WHEN** a chore is created with time "25:00"
- **THEN** no chore is created and the dialog shows the time error, keeping the other fields
