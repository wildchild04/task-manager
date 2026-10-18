## MODIFIED Requirements

### Requirement: Project home and dashboard
`/projects/:projectId` SHALL show the project's title, its home page content (editable, as specified by the `block-editor` capability), and its dashboard: one card per dashboard section in the dashboard's order, each with its title, its count, and its items. Task items SHALL link to the task overview; library items SHALL link to the document. Chore items SHALL show an "Urgent" marker when urgent and their due time in the workspace time zone. A section with no items SHALL show that it is empty. The project home SHALL offer deleting the project with a button at the top right, which opens a confirmation dialog naming the project and saying how many tasks and library documents will be deleted with it; only confirming SHALL delete, after which the browser SHALL go to the home route. An unknown project SHALL show the not-found page with status 404.

#### Scenario: Dashboard cards
- **WHEN** a project has one work task in progress and no updates
- **THEN** the project home shows a "Work in progress" card with count 1 linking to that task, and an "Open updates" card showing it is empty

#### Scenario: Urgent chore
- **WHEN** a project has an overdue chore
- **THEN** its item in the "Chores" card shows the "Urgent" marker and its due time

#### Scenario: Unknown project
- **WHEN** `/projects/does-not-exist` is opened
- **THEN** the not-found page is shown with status 404

#### Scenario: Delete a project
- **WHEN** the delete button of project "Garden" (with 3 tasks and 1 document) is pressed and confirmed
- **THEN** the dialog said that 3 tasks and 1 document would be deleted, the browser is on the home route, and "Garden" is no longer listed
