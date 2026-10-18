# project-screens Specification

## Purpose
TBD - created by archiving change project-ui. Update Purpose after archive.
## Requirements
### Requirement: Projects home
The home route `/` SHALL list all projects, oldest first, each linking to its project home. It SHALL offer creating a project by title; after creation the browser SHALL go to the new project's home. An empty title SHALL be rejected with a message, keeping the dialog open.

#### Scenario: Create a project
- **WHEN** a project titled "Taskhub" is created from the home route
- **THEN** the browser is on `/projects/<id>` for the new project, and the navigation lists it

#### Scenario: Empty title
- **WHEN** a project is created with an empty title
- **THEN** no project is created and the dialog shows that a title is required

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
- **explorations and work:** a quick-add row with the title; while it holds text, the list SHALL show only the tasks whose title or state (as shown, e.g. "To do", "In progress") contains that text (ignoring case and surrounding spaces), saying when none match, and creating the task SHALL clear the row and the filter
- **updates:** a dialog with the title and the done work task it iterates on, chosen from the project's done work; if the project has no done work, the dialog SHALL say so and creation SHALL be unavailable
- **chores:** a dialog with the title, urgency (normal or urgent), and an optional schedule of any of the five types with that type's fields

Rejected input (for example an empty title, an invalid time or a missing field) SHALL be shown next to the form without losing what was entered. A created task SHALL appear in the list.

#### Scenario: Quick-add work
- **WHEN** "Add login" is entered in the work list's quick-add row
- **THEN** a work task "Add login" in `todo` appears in the list

#### Scenario: Quick-add filters the list
- **WHEN** "sign" is typed in the work list's quick-add row, with work "Sign in with OAuth" and "Search"
- **THEN** only "Sign in with OAuth" is listed, and after pressing Enter a work task "sign" is created and the whole list shows again

#### Scenario: Filter by state
- **WHEN** "to do" is typed in the work list's quick-add row, with "Search" in to do and "Project screens" in progress
- **THEN** "Search" is listed and "Project screens" is not

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
`/tasks/:taskId` SHALL show a task: its title, kind, state, a link to its project, and its body page content. The title and body SHALL be editable as specified by the `block-editor` capability. For a chore the header SHALL also show its urgency (an "Urgent" marker when urgent, including because overdue) and its schedule in words with its next due time in the workspace time zone, as a button in its action row that opens the schedule editor ("No schedule" when it has none). Acting on the task (transitions, comments, references, lineage) is specified by the `task-screen` capability. An unknown task SHALL show the not-found page with status 404.

#### Scenario: Chore overview
- **WHEN** the overview of a weekly Monday 09:00 chore is opened
- **THEN** its header shows "Every Monday at 09:00" with the next due time

#### Scenario: Unknown task
- **WHEN** `/tasks/does-not-exist` is opened
- **THEN** the not-found page is shown with status 404

### Requirement: Project home
`/projects/:projectId` SHALL show the project's title, a quick-glance header, and its content in tabs.

The header SHALL show, from the project's dashboard: how much work is to do and in progress, how much was returned (only when some was), how many explorations are open, how many updates are open (only when some are), and how many chores are to do with the next due time, plus how many are urgent (only when some are).

The tabs SHALL be Description (the home page content, editable as specified by the `block-editor` capability, the default), Work, Explorations, Updates, Chores and Library, each but Description labelled with its count when it isn't zero. Work SHALL list the project's work in progress, then returned work, then other work to do; Explorations and Updates their open tasks; Chores the chores to do in the chore order with the "Urgent" marker and due time in the workspace time zone; Library the knowledge library's documents as a tree. Every item SHALL link to its task or document, each task tab SHALL link to its full task list and Library to the library page, and an empty tab SHALL say so. The open tab SHALL be part of the URL (`?tab=`) so a reload or link opens it; switching tabs SHALL keep unsaved edits to the description. The project home SHALL offer deleting the project with a button at the top right, which opens a confirmation dialog naming the project and saying how many tasks and library documents will be deleted with it; only confirming SHALL delete, after which the browser SHALL go to the home route. An unknown project SHALL show the not-found page with status 404.

#### Scenario: Quick glance and tabs
- **WHEN** a project has one work task in progress, two to do, four open explorations and no updates
- **THEN** the header shows "2 to do", "1 in progress" and "4 open explorations" without updates; the tabs read Description, Work (3), Explorations (4), Updates, Chores, Library; the Work tab lists the task in progress first, and the Updates tab says it is empty

#### Scenario: Urgent chore
- **WHEN** a project has an overdue chore
- **THEN** the header shows "1 urgent", and the chore's item in the Chores tab shows the "Urgent" marker and its due time

#### Scenario: Unknown project
- **WHEN** `/projects/does-not-exist` is opened
- **THEN** the not-found page is shown with status 404

#### Scenario: Delete a project
- **WHEN** the delete button of project "Garden" (with 3 tasks and 1 document) is pressed and confirmed
- **THEN** the dialog said that 3 tasks and 1 document would be deleted, the browser is on the home route, and "Garden" is no longer listed

