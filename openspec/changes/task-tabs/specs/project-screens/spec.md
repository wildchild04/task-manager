## MODIFIED Requirements

### Requirement: Task overview
`/tasks/:taskId` SHALL show a task: its title, kind, state, a link to its project, and its body page content. The title and body SHALL be editable as specified by the `block-editor` capability. For a chore the header SHALL also show its urgency (an "Urgent" marker when urgent, including because overdue) and its schedule in words with its next due time in the workspace time zone, as a chip that opens the schedule editor ("No schedule" when it has none). Acting on the task (transitions, comments, references, lineage) is specified by the `task-screen` capability. An unknown task SHALL show the not-found page with status 404.

#### Scenario: Chore overview
- **WHEN** the overview of a weekly Monday 09:00 chore is opened
- **THEN** its header shows "Every Monday at 09:00" with the next due time

#### Scenario: Unknown task
- **WHEN** `/tasks/does-not-exist` is opened
- **THEN** the not-found page is shown with status 404
