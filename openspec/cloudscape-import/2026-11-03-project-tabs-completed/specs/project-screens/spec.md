## MODIFIED Requirements

### Requirement: Project home
`/projects/:projectId` SHALL show the project's title, a quick-glance header, and its content in tabs.

The header SHALL show, from the project's dashboard and for the kinds its mode offers: how much work is to do and in progress, how much was returned (only when some was), how many explorations are open, how many updates are open (only when some are), and how many chores are to do with the next due time, plus how many are urgent (only when some are). A container's counts SHALL include its sub-projects' tasks. A sub-project's home SHALL show a breadcrumb to its container.

The tabs SHALL be Description (the home page content, editable as specified by the `block-editor` capability, the default), then those of Work, Explorations, Updates, Chores and Tickets that its mode offers, then, for a container (not a sub-project), its sub-projects tab named as its mode names them ("Sub-projects", or "Root causes"), then Library, each but Description labelled with its count when it isn't zero. Work SHALL list the project's work in progress, then returned work, then other work to do; Explorations and Updates their open tasks; Chores the chores to do in the chore order with the "Urgent" marker and due time in the workspace time zone; the sub-projects tab the container's sub-projects, oldest first, each with its active work count and linking to its home, with creating a sub-project (by title; it opens once created); Library the knowledge library's documents as a tree. Each task tab SHALL offer a "Show completed" toggle, labelled with how many completed tasks it has and off by default, which lists under "Completed" the tab's kind's tasks in their end states (done and cancelled work and chores, promoted and tombstoned explorations and updates, closed tickets, ended experiments), most recently updated first, each with its state; the toggle SHALL be part of the URL (`?completed=1`) and apply to every task tab. A container's completed tasks SHALL include its sub-projects'. Every item SHALL link to its task or document, each task tab SHALL link to its full task list and Library to the library page, and an empty tab SHALL say so. The open tab SHALL be part of the URL (`?tab=`) so a reload or link opens it; switching tabs SHALL keep unsaved edits to the description. The project home SHALL offer deleting the project with a button at the top right, which opens a confirmation dialog naming the project and saying how many sub-projects, tasks and library documents will be deleted with it; only confirming SHALL delete, after which the browser SHALL go to the home route. An unknown project SHALL show the not-found page with status 404.

#### Scenario: Quick glance and tabs
- **WHEN** a project has one work task in progress, two to do, four open explorations and no updates
- **THEN** the header shows "2 to do", "1 in progress" and "4 open explorations" without updates; the tabs read Description, Work (3), Explorations (4), Updates, Chores, Library; the Work tab lists the task in progress first, and the Updates tab says it is empty

#### Scenario: Project work home
- **WHEN** Project work container "Taskhub" with one work task to do and sub-project "Editor" is opened
- **THEN** the header shows "1 to do" and "0 in progress" without explorations, updates or chores, and the tabs read Description, Work (1), Sub-projects (1), Library

#### Scenario: Create a sub-project
- **WHEN** "Editor" is created from Taskhub's Sub-projects tab
- **THEN** the browser is on Editor's home, which has a breadcrumb to "Taskhub", and Taskhub's Sub-projects tab lists "Editor"

#### Scenario: Root causes tab
- **WHEN** a shift with root cause "DNS" is opened
- **THEN** its tabs include "Root causes (1)", listing "DNS"

#### Scenario: Urgent chore
- **WHEN** a project has an overdue chore
- **THEN** the header shows "1 urgent", and the chore's item in the Chores tab shows the "Urgent" marker and its due time

#### Scenario: Unknown project
- **WHEN** `/projects/does-not-exist` is opened
- **THEN** the not-found page is shown with status 404

#### Scenario: Delete a project
- **WHEN** the delete button of project "Garden" (with 3 tasks and 1 document) is pressed and confirmed
- **THEN** the dialog said that 3 tasks and 1 document would be deleted, the browser is on the home route, and "Garden" is no longer listed

#### Scenario: Show completed work
- **WHEN** a project has work "Still to do" and done work "Shipped already", and its Work tab's "Show completed (1)" is turned on
- **THEN** "Shipped already" is listed under "Completed" with its state, the URL has `completed=1`, and it is still listed after a reload

### Requirement: Task lists
`/projects/:projectId/explorations`, `/updates`, `/work` and `/chores` SHALL each show a table of that kind's tasks, for each kind the project's mode offers; a list of a kind the mode doesn't offer SHALL show the not-found page with status 404. A container's list SHALL show the container's own tasks and its sub-projects', with a column naming each task's sub-project (empty for the container's own); a sub-project's list SHALL show only its own tasks. The table SHALL show the task title (linking to the task overview), its state, and when it was last updated; the chores table SHALL also show urgency and due time and use the dashboard's chore order. Where the list has a search box (explorations and work), typing SHALL match the task's title, its state's name and, in a container's list, its sub-project's name. A state filter SHALL narrow the table:

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
- **WHEN** "editor" is typed in the search box of Taskhub's work list, where "Tables" is in sub-project "Editor"
- **THEN** "Tables" is listed, and Taskhub's own work isn't
