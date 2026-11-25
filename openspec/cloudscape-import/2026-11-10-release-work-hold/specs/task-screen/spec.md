## ADDED Requirements

### Requirement: Releasing an agent's hold

While an agent holds a work task (it started or took over the task, which is in progress), the task page SHALL show "Held by" with the agent's name and a Release button. Releasing SHALL keep the task in progress with no holder, so another agent can take it over, and SHALL be recorded in its history. Nothing SHALL show for a task nobody holds; releasing one SHALL show "No agent holds this task". The home page's in-progress work SHALL name the agent holding it, if any.

#### Scenario: Release a stuck agent's work

- **WHEN** "builder" started a work task and the human clicks Release on its page
- **THEN** the task is still in progress, "Held by" is gone, and the home page shows it as "In progress" without "builder"
