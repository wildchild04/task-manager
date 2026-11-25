## ADDED Requirements

### Requirement: Searching lists
Every task list page SHALL have a property filter above its table. Free text SHALL match a task whose title, state (as shown, e.g. "To do", "In progress"), ticket ID, severity, hypothesis, urgency ("Urgent", "Normal") or sub-project name contains it, ignoring case and surrounding spaces. It SHALL offer filtering on Title (contains, doesn't contain, equals), State (equals, doesn't equal) and, where the list shows them, Ticket ID (equals, contains), Severity (equals, doesn't equal), Hypothesis (contains, doesn't contain), Urgency (equals) and the sub-project, named as the mode names it (equals, doesn't equal), suggesting the values the list's tasks have. Filters SHALL all have to match, or any of them when "or" is chosen. The filter applies within the selected state filter; the filter and the "or" choice SHALL be part of the URL (`?f=`, `?join=or`), so a filtered list can be reloaded and shared, and SHALL be kept when the state filter changes. The header's count SHALL be the matching tasks out of the list's ("(1/3)") while filtering. When nothing matches, the table SHALL say so and offer clearing the filter.

Each project home task tab SHALL have a search box matching its items and, when shown, its completed items, by title, state or marker, detail (due or updated time, hypothesis, ticket ID) and ticket ID, the same way; the text SHALL be part of the URL (`?q=`) and apply to every task tab, and when nothing matches the tab SHALL say so. The tab labels SHALL keep counting all their tasks.

The home page's Needs attention, Waiting for review and Recently edited lists SHALL each have a search box matching an item's title, its project or place, and its reason (Needs attention) or its agents (Waiting for review). Needs attention SHALL search everything that needs attention and show at most 10 of the matches with how many more there are; Recently edited SHALL search the items it shows. When nothing matches, the list SHALL say so.

#### Scenario: Tickets by severity
- **WHEN** a shift's tickets list has "Disk full" with severity 2 and "Latency" with severity 3, and the filter "Severity = 2" is added
- **THEN** only "Disk full" is listed, the header counts "(1/2)", and after a reload the filter is still applied

#### Scenario: Free text matches the ticket ID
- **WHEN** "SIM-42" is typed in the tickets list's filter, where only "Latency" has ticket ID "SIM-42"
- **THEN** only "Latency" is listed

#### Scenario: Filter by state name
- **WHEN** "to do" is typed in the work list's filter, with "Search" in to do and "Project screens" in progress
- **THEN** "Search" is listed and "Project screens" is not

#### Scenario: Either filter
- **WHEN** the chores list is filtered by "Urgency = Urgent" or "Title contains water", with urgent "Fix fence", normal "Water plants" and normal "Sweep"
- **THEN** "Fix fence" and "Water plants" are listed and "Sweep" is not

#### Scenario: State filter keeps the search
- **WHEN** the work list is filtered by "login" and the "All" state filter is chosen
- **THEN** the URL still holds the filter and only matching work in any state is listed

#### Scenario: Nothing matches
- **WHEN** "zzz" is typed in the experiments list's filter
- **THEN** the table says nothing matches and offers clearing the filter, which lists every experiment again

#### Scenario: Search a project tab
- **WHEN** "oven" is typed in the Work tab's search box of a project with work "Fix oven" and "Bake bread", and "Show completed" is on with completed "Clean oven"
- **THEN** the tab lists "Fix oven" and, under "Completed", "Clean oven", but not "Bake bread", and the URL holds `q=oven`

#### Scenario: Search needs attention beyond the first 10
- **WHEN** 12 work tasks are in progress and the eleventh's title is searched in Needs attention
- **THEN** Needs attention lists only that task, without "more"

### Requirement: Creating tasks from a list
Each task list SHALL offer creating a task of its kind in its initial state, in the project the list belongs to (a container's list creates in the container), with a server-generated ID, from a "New <kind>" button in its header that opens the kind's create dialog (for explorations and work, asking for the title), and no other way; and:
- **updates:** a dialog with the title and the done work task it iterates on, chosen from the project's done work; if the project has no done work, the dialog SHALL say so and creation SHALL be unavailable
- **chores:** a dialog with the title, urgency (normal or urgent), and an optional schedule of any of the five types with that type's fields

Rejected input (for example an empty title, an invalid time or a missing field) SHALL be shown next to the form without losing what was entered. A created task SHALL appear in the list.

#### Scenario: Update needs done work
- **WHEN** the update dialog is opened in a project with no done work
- **THEN** it explains that an update iterates on done work and creation is unavailable

#### Scenario: Scheduled chore
- **WHEN** a chore "Water plants" is created with a weekly schedule on Monday at 09:00
- **THEN** it appears in the chores list with its next Monday 09:00 due time

#### Scenario: Invalid time
- **WHEN** a chore is created with time "25:00"
- **THEN** no chore is created and the dialog shows the time error, keeping the other fields

A project home SHALL offer a "New task" menu listing the kinds its mode offers ("New exploration", "New update", "New work", "New chore" for Personal); choosing one SHALL open that kind's create dialog, creating in the project, and the created task SHALL open.

#### Scenario: Create from the project home
- **WHEN** "New work" is chosen from a Personal project's "New task" menu and "Dig the beds" is created
- **THEN** the browser is on the new work task's page, and it is in the project's work list

#### Scenario: New button on a list
- **WHEN** "New exploration" is clicked on a project's explorations list and "Prune in winter" is created
- **THEN** the dialog closes and the list shows "Prune in winter"

#### Scenario: New work from its list
- **WHEN** "New work" is clicked on a project's work list and "Add login" is created
- **THEN** the dialog closes, the work list has no quick-add row, and it shows "Add login" in to do

## MODIFIED Requirements

### Requirement: Task lists
`/projects/:projectId/explorations`, `/updates`, `/work` and `/chores` SHALL each show a table of that kind's tasks, for each kind the project's mode offers; a list of a kind the mode doesn't offer SHALL show the not-found page with status 404. A container's list SHALL show the container's own tasks and its sub-projects', with a column naming each task's sub-project (empty for the container's own); a sub-project's list SHALL show only its own tasks. The table SHALL show the task title (linking to the task overview), its state, and when it was last updated; the chores table SHALL also show urgency and due time and use the dashboard's chore order. Every list SHALL be searchable as specified by "Searching lists". A state filter SHALL narrow the table:

| List | Filters (first is the default) |
|---|---|
| explorations, updates | Open · Tombstoned · Promoted · All |
| work | Active (todo and in progress) · Done · Cancelled · All |
| chores | To do · Done · Cancelled · All |

The selected filter SHALL be part of the URL, so a filtered list can be reloaded and shared. A list with no tasks for the filter SHALL show an empty state.

#### Scenario: List the mode doesn't offer
- **WHEN** `/projects/<id>/chores` is opened for a Project work container
- **THEN** the not-found page is shown with status 404

#### Scenario: Container list includes sub-projects
- **WHEN** Project work container "Taskhub" has work "Release" and its sub-project "Editor" has work "Tables", and Taskhub's work list is opened
- **THEN** both are listed, "Tables" with "Editor" in the sub-project column; Editor's work list shows only "Tables"

#### Scenario: Default filter
- **WHEN** a project has an open and a tombstoned exploration and the explorations list is opened
- **THEN** only the open exploration is shown

#### Scenario: Filter in the URL
- **WHEN** the work list is opened with the "Done" filter and the page is reloaded
- **THEN** the "Done" filter is still selected and only done work is shown

#### Scenario: Search by sub-project
- **WHEN** "editor" is typed in the filter of Taskhub's work list, where "Tables" is in sub-project "Editor"
- **THEN** "Tables" is listed, and Taskhub's own work isn't

## REMOVED Requirements

### Requirement: Creating tasks
**Reason**: The quick-add row on the work and explorations lists is removed and searching moves to "Searching lists".
**Migration**: Create from the list's "New <kind>" button; the rest of creating tasks is in "Creating tasks from a list".
