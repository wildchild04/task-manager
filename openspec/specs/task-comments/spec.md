# task-comments Specification

## Purpose
TBD - created by archiving change task-comments. Update Purpose after archive.
## Requirements
### Requirement: Comment record
A comment SHALL have: a caller-generated unique ID, the ID of the task it belongs to, an author (the human user or an agent identified by name), a body, `createdAt`, and `editedAt` (empty until the first edit). The body SHALL be a `comment` block that is an owned root with owner `comment:<id>`, created in the same transaction as the comment.

#### Scenario: Add a comment
- **WHEN** agent "builder" adds a comment containing a paragraph and a todo to a work task
- **THEN** the comment exists on that task with author agent "builder", and its body contains the paragraph and the todo in order

#### Scenario: Comment and body are created together
- **WHEN** creating the comment's body fails
- **THEN** the comment is not created either

### Requirement: Which tasks allow comments
Comments SHALL be allowed on tasks of kind `work` and `chore`, in any state. Adding a comment to an `exploration` or `update` SHALL be rejected, since those are documents themselves.

#### Scenario: Comment on a chore
- **WHEN** a comment is added to a chore
- **THEN** it is created

#### Scenario: Comment on done work
- **WHEN** a comment is added to a work task in state `done`
- **THEN** it is created

#### Scenario: Comment on an exploration is rejected
- **WHEN** a comment is added to an exploration
- **THEN** it is rejected

### Requirement: Block bodies
A comment's body SHALL be able to contain any block type except `page` and `comment`, including `reference` blocks. A comment's body SHALL change only through the comment service, not through general block batches.

#### Scenario: Page inside a comment is rejected
- **WHEN** a comment body is given a `page` block
- **THEN** the operation is rejected

#### Scenario: Comment body cannot be changed directly
- **WHEN** a general block batch, outside the comment service, updates a block inside a comment's body
- **THEN** the batch is rejected

### Requirement: Flat, ordered list
Listing a task's comments SHALL return all of them, oldest first by `createdAt`. Comments SHALL NOT have replies or types.

#### Scenario: Comments in order
- **WHEN** comments C1, C2 and C3 are added to a task in that order
- **THEN** listing the task's comments returns `[C1, C2, C3]`

### Requirement: Editing comments
A comment's body SHALL be editable with a block batch that only touches blocks inside that comment's body. A successful edit SHALL set `editedAt`. The author and `createdAt` SHALL NOT change.

#### Scenario: Edit a comment
- **WHEN** a comment's paragraph is changed through the comment service
- **THEN** the body shows the new text and `editedAt` is set

#### Scenario: Edit cannot reach outside the comment
- **WHEN** an edit batch for comment C includes an operation on a block outside C's body
- **THEN** the edit is rejected and nothing changes

### Requirement: Deleting comments
Deleting a comment SHALL remove the comment and its whole body. Relations and reference blocks pointing at the comment or at blocks in its body SHALL remain and resolve as missing.

#### Scenario: Delete a referenced comment
- **WHEN** an exploration references comment C and C is deleted
- **THEN** the exploration's reference to C resolves as missing

### Requirement: Comments are referenceable
`comment` SHALL be registered as a referenceable entity kind, so a task's `references` relation can target a comment.

#### Scenario: Start an update from a comment
- **WHEN** a new update is created referencing a comment on a done work task
- **THEN** the reference is created and resolves to that comment

### Requirement: Returning work posts a comment
Applying `return` to work SHALL create a comment on that work, authored by the actor applying `return`, whose body contains the reason as a paragraph followed by any additional blocks given with the `return`. The comment, the state change, the body-page update and the history entry SHALL be applied together or not at all.

#### Scenario: Agent returns work
- **WHEN** agent "builder" applies `return` with reason "OAuth provider not decided"
- **THEN** the work is `todo` and its newest comment is by agent "builder" and starts with "OAuth provider not decided"

#### Scenario: Comment failure blocks the return
- **WHEN** creating the return comment fails
- **THEN** the work stays `in_progress`, and no comment, body change or history entry is stored

