## MODIFIED Requirements

### Requirement: Project home and dashboard
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
