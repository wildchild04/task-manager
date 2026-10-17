## ADDED Requirements

### Requirement: Task record
A task SHALL have: a caller-generated unique ID, the ID of the project it belongs to, a `kind`, a current `state`, a body page ID, kind-specific attributes, and `createdAt` / `updatedAt` timestamps. The project SHALL exist when the task is created.

#### Scenario: Create a task
- **WHEN** a `work` task is created in project P with title "Add login"
- **THEN** the task exists in P with kind `work`, state `todo`, and a body page titled "Add login"

#### Scenario: Unknown project
- **WHEN** a task is created for a project ID that does not exist
- **THEN** creation is rejected with a not-found error

### Requirement: Fixed kinds
A task's kind SHALL be one of `exploration`, `update`, `work`, `chore`, and SHALL never change after creation. Moving from one kind to another (for example promoting an exploration) SHALL create a new task.

#### Scenario: Kind cannot be changed
- **WHEN** an update attempts to change an exploration's kind to `work`
- **THEN** it is rejected

### Requirement: Body page
Every task SHALL have exactly one body page: a `page` block that is an owned root with owner `task:<id>`, created in the same transaction as the task. Body pages SHALL NOT appear in the knowledge library or among the workspace's root pages; they are reached through their task. The task's title SHALL be the title of its body page; there is no separate title field. The body page SHALL NOT be deleted while the task exists.

#### Scenario: Task and page are created together
- **WHEN** creating the body page fails
- **THEN** the task is not created either

#### Scenario: Renaming the page renames the task
- **WHEN** the body page's title is changed to "Add OAuth login"
- **THEN** the task's title is "Add OAuth login"

#### Scenario: Body page cannot be deleted
- **WHEN** a block batch tries to delete a task's body page
- **THEN** the batch is rejected

### Requirement: Kind-specific attributes
Each kind SHALL define a schema for its attributes, and attributes that do not match their kind's schema SHALL be rejected. Kinds without attributes in this change SHALL accept only an empty attribute set. Kind-specific changes extend these schemas.

#### Scenario: Attributes are validated
- **WHEN** a task is created with attributes its kind's schema does not allow
- **THEN** creation is rejected with a validation error

### Requirement: Listing tasks
The system SHALL list a project's tasks filtered by any combination of kind and state.

#### Scenario: Filter by kind and state
- **WHEN** tasks of a project are listed with kind `exploration` and state `tombstoned`
- **THEN** only that project's tombstoned explorations are returned
