## MODIFIED Requirements

### Requirement: Project home and dashboard
`/projects/:projectId` SHALL show the project's title, its home page content (editable, as specified by the `block-editor` capability), and its dashboard: one card per dashboard section in the dashboard's order, each with its title, its count, and its items. Task items SHALL link to the task overview; library items SHALL link to the document. Chore items SHALL show an "Urgent" marker when urgent and their due time in the workspace time zone. A section with no items SHALL show that it is empty. An unknown project SHALL show the not-found page with status 404.

#### Scenario: Dashboard cards
- **WHEN** a project has one work task in progress and no updates
- **THEN** the project home shows a "Work in progress" card with count 1 linking to that task, and an "Open updates" card showing it is empty

#### Scenario: Urgent chore
- **WHEN** a project has an overdue chore
- **THEN** its item in the "Chores" card shows the "Urgent" marker and its due time

#### Scenario: Unknown project
- **WHEN** `/projects/does-not-exist` is opened
- **THEN** the not-found page is shown with status 404

### Requirement: Task overview
`/tasks/:taskId` SHALL show a task: its title, kind, state, a link to its project, and its body page content. The title and body SHALL be editable as specified by the `block-editor` capability. For a chore it SHALL also show its urgency (including when urgent because overdue), its schedule in words, and its due time in the workspace time zone. Acting on the task (transitions, comments, references, lineage) is specified by the `task-screen` capability. An unknown task SHALL show the not-found page with status 404.

#### Scenario: Chore overview
- **WHEN** the overview of a weekly Monday 09:00 chore is opened
- **THEN** it shows "Every Monday at 09:00" and the next due time

#### Scenario: Unknown task
- **WHEN** `/tasks/does-not-exist` is opened
- **THEN** the not-found page is shown with status 404
