# project Specification

## Purpose
TBD - created by archiving change project-structure. Update Purpose after archive.
## Requirements
### Requirement: Project record
A project SHALL have: a caller-generated unique ID, a home page, a knowledge library root, and `createdAt` / `updatedAt` timestamps. The home page and the library root SHALL be `page` blocks that are owned roots with owner `project:<id>`, created in the same transaction as the project.

#### Scenario: Create a project
- **WHEN** a project is created with title "Notion task manager"
- **THEN** the project exists with a home page titled "Notion task manager" and an empty knowledge library

#### Scenario: Project and its pages are created together
- **WHEN** creating the home page or the library root fails
- **THEN** the project is not created either

### Requirement: Title is the home page title
A project's title SHALL be the title of its home page; there is no separate title field.

#### Scenario: Rename a project
- **WHEN** the home page's title is changed to "Taskhub"
- **THEN** the project's title is "Taskhub"

### Requirement: Home page
The home page SHALL be an ordinary page: it can contain any blocks, including `reference` blocks to tasks, documents and blocks in this or other projects. Its content SHALL be editable through normal block batches. The home page and the library root SHALL NOT be deletable through block batches.

#### Scenario: Home page holds references
- **WHEN** a reference block pointing at a work task's body page is added to the home page
- **THEN** loading the home page includes that reference block

#### Scenario: Home page cannot be deleted
- **WHEN** a block batch tries to delete a project's home page or library root
- **THEN** the batch is rejected

### Requirement: Owned roots stay out of the workspace pages
A project's home page and library root SHALL NOT appear among the workspace's root pages.

#### Scenario: Workspace root pages
- **WHEN** two projects exist and the workspace's root pages are listed
- **THEN** neither project's home page nor library root is in the list

### Requirement: Listing projects
The system SHALL list all projects, oldest first by `createdAt`, each with its ID and title.

#### Scenario: List projects
- **WHEN** projects A and then B are created
- **THEN** listing projects returns `[A, B]` with their titles

### Requirement: Deleting a project
Deleting a project SHALL remove, in one transaction, the project, its home page and knowledge library (with every page and block in them), and every task of the project with its body page, comments (and their content), transition history and relations from it. Relations and mentions elsewhere that point at anything deleted SHALL remain and resolve as missing. If any part fails, nothing SHALL be deleted. Deleting an unknown project SHALL be refused.

#### Scenario: Delete a project with tasks and documents
- **WHEN** a project with two tasks (one with comments) and a library document is deleted
- **THEN** the project, its tasks, their comments and history, its home page and the document no longer exist, and the project is no longer listed

#### Scenario: References from other projects
- **WHEN** a task in project B references a task in project A, and project A is deleted
- **THEN** the task in B still exists and its reference resolves as missing

