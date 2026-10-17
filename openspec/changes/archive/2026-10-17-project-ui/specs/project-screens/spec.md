## ADDED Requirements

### Requirement: Projects home
The home route `/` SHALL list all projects, oldest first, each linking to its project home. It SHALL offer creating a project by title; after creation the browser SHALL go to the new project's home. An empty title SHALL be rejected with a message, keeping the dialog open.

#### Scenario: Create a project
- **WHEN** a project titled "Taskhub" is created from the home route
- **THEN** the browser is on `/projects/<id>` for the new project, and the navigation lists it

#### Scenario: Empty title
- **WHEN** a project is created with an empty title
- **THEN** no project is created and the dialog shows that a title is required

### Requirement: Project home and dashboard
`/projects/:projectId` SHALL show the project's title, its home page content (read-only, rendered like any page), and its dashboard: one card per dashboard section in the dashboard's order, each with its title, its count, and its items. Task items SHALL link to the task overview; library items SHALL link to the document. Chore items SHALL show an "Urgent" marker when urgent and their due time in the workspace time zone. A section with no items SHALL show that it is empty. An unknown project SHALL show the not-found page with status 404.

#### Scenario: Dashboard cards
- **WHEN** a project has one work task in progress and no updates
- **THEN** the project home shows a "Work in progress" card with count 1 linking to that task, and an "Open updates" card showing it is empty

#### Scenario: Urgent chore
- **WHEN** a project has an overdue chore
- **THEN** its item in the "Chores" card shows the "Urgent" marker and its due time

#### Scenario: Unknown project
- **WHEN** `/projects/does-not-exist` is opened
- **THEN** the not-found page is shown with status 404

### Requirement: Task lists
`/projects/:projectId/explorations`, `/updates`, `/work` and `/chores` SHALL each show a table of that kind's tasks in the project, with the task title (linking to the task overview), its state, and when it was last updated; the chores table SHALL also show urgency and due time and use the dashboard's chore order. A state filter SHALL narrow the table:

| List | Filters (first is the default) |
|---|---|
| explorations, updates | Open · Tombstoned · Promoted · All |
| work | Active (todo and in progress) · Done · Cancelled · All |
| chores | To do · Done · Cancelled · All |

The selected filter SHALL be part of the URL, so a filtered list can be reloaded and shared. A list with no tasks for the filter SHALL show an empty state.

#### Scenario: Default filter
- **WHEN** a project has an open and a tombstoned exploration and the explorations list is opened
- **THEN** only the open exploration is shown

#### Scenario: Filter in the URL
- **WHEN** the work list is opened with the "Done" filter and the page is reloaded
- **THEN** the "Done" filter is still selected and only done work is shown

### Requirement: Creating tasks
Each task list SHALL offer creating a task of its kind in its initial state, with a server-generated ID:
- **explorations and work:** a quick-add row with the title
- **updates:** a dialog with the title and the done work task it iterates on, chosen from the project's done work; if the project has no done work, the dialog SHALL say so and creation SHALL be unavailable
- **chores:** a dialog with the title, urgency (normal or urgent), and an optional schedule of any of the five types with that type's fields

Rejected input (for example an empty title, an invalid time or a missing field) SHALL be shown next to the form without losing what was entered. A created task SHALL appear in the list.

#### Scenario: Quick-add work
- **WHEN** "Add login" is entered in the work list's quick-add row
- **THEN** a work task "Add login" in `todo` appears in the list

#### Scenario: Update needs done work
- **WHEN** the update dialog is opened in a project with no done work
- **THEN** it explains that an update iterates on done work and creation is unavailable

#### Scenario: Scheduled chore
- **WHEN** a chore "Water plants" is created with a weekly schedule on Monday at 09:00
- **THEN** it appears in the chores list with its next Monday 09:00 due time

#### Scenario: Invalid time
- **WHEN** a chore is created with time "25:00"
- **THEN** no chore is created and the dialog shows the time error, keeping the other fields

### Requirement: Knowledge library page
`/projects/:projectId/library` SHALL show the project's library as a tree of document links (to `/pages/:pageId`), in sibling order, with every level expanded. It SHALL offer creating a document with a title, either at the top level or inside an existing document, added after that parent's last child. An empty library SHALL show an empty state.

#### Scenario: Nested document
- **WHEN** a document "Auth design" is created inside "Architecture"
- **THEN** the library page shows "Auth design" nested under "Architecture", linking to its page

### Requirement: Task overview
`/tasks/:taskId` SHALL show a task read-only: its title, kind, state, a link to its project, and its body page content rendered like any page. For a chore it SHALL also show its urgency (including when urgent because overdue), its schedule in words, and its due time in the workspace time zone. An unknown task SHALL show the not-found page with status 404.

#### Scenario: Chore overview
- **WHEN** the overview of a weekly Monday 09:00 chore is opened
- **THEN** it shows "Every Monday at 09:00" and the next due time

#### Scenario: Unknown task
- **WHEN** `/tasks/does-not-exist` is opened
- **THEN** the not-found page is shown with status 404
