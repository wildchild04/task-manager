## ADDED Requirements

### Requirement: Where a task is mentioned
A task's page SHALL list the places that mention the task inline or reference its description with a reference block: each page (with its title, linking to it) and each other task (with its title and kind, linking to it), once per place with the count when more than one. The task's own description SHALL NOT be listed, and the section SHALL NOT be shown when nothing points at the task.

#### Scenario: Mentioned by a document
- **WHEN** document "Release plan" mentions the work task "Add login"
- **THEN** the task's page lists "Release plan" under "Mentioned in", linking to it
