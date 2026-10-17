## MODIFIED Requirements

### Requirement: Task overview
`/tasks/:taskId` SHALL show a task: its title, kind, state, a link to its project, and its body page content rendered like any page. For a chore it SHALL also show its urgency (including when urgent because overdue), its schedule in words, and its due time in the workspace time zone. The title and body SHALL stay read-only; acting on the task (transitions, comments, references, lineage) is specified by the `task-screen` capability. An unknown task SHALL show the not-found page with status 404.

#### Scenario: Chore overview
- **WHEN** the overview of a weekly Monday 09:00 chore is opened
- **THEN** it shows "Every Monday at 09:00" and the next due time

#### Scenario: Unknown task
- **WHEN** `/tasks/does-not-exist` is opened
- **THEN** the not-found page is shown with status 404
