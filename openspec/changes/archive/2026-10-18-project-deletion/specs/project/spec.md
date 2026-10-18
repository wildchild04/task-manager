## ADDED Requirements

### Requirement: Deleting a project
Deleting a project SHALL remove, in one transaction, the project, its home page and knowledge library (with every page and block in them), and every task of the project with its body page, comments (and their content), transition history and relations from it. Relations and mentions elsewhere that point at anything deleted SHALL remain and resolve as missing. If any part fails, nothing SHALL be deleted. Deleting an unknown project SHALL be refused.

#### Scenario: Delete a project with tasks and documents
- **WHEN** a project with two tasks (one with comments) and a library document is deleted
- **THEN** the project, its tasks, their comments and history, its home page and the document no longer exist, and the project is no longer listed

#### Scenario: References from other projects
- **WHEN** a task in project B references a task in project A, and project A is deleted
- **THEN** the task in B still exists and its reference resolves as missing
