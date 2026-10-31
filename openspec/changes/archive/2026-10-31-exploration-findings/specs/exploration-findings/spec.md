## ADDED Requirements

### Requirement: Finding record
A finding SHALL be a record of an exploration's results with a caller-generated unique ID, the ID of the exploration it belongs to, an author (the human user, or an agent identified by name), a body, `createdAt`, and `editedAt` (empty until the first edit). Its body SHALL follow the same rules as a comment body: an owned root created in the same transaction as the finding, able to hold any block type except `page` and `comment`, and changed only through the service that manages findings. Findings and comments SHALL be listed separately: a task's comments SHALL never include its findings, and its findings SHALL never include its comments.

#### Scenario: Add a finding
- **WHEN** agent "builder" adds a finding containing a paragraph and a bulleted item to an exploration
- **THEN** the exploration's findings end with that finding by agent "builder", with the paragraph and the bulleted item in order

#### Scenario: Findings are not comments
- **WHEN** a finding is added to an exploration
- **THEN** listing the exploration's comments returns nothing

### Requirement: Which tasks have findings
Findings SHALL be allowed only on tasks of kind `exploration`, in any state (open, promoted or tombstoned). Adding a finding to a work task, chore or update SHALL be rejected.

#### Scenario: Finding on a promoted exploration
- **WHEN** a finding is added to an exploration that has been promoted
- **THEN** it is created

#### Scenario: Finding on work is rejected
- **WHEN** a finding is added to a work task
- **THEN** it is rejected and nothing is created

### Requirement: Ordered list of findings
Listing an exploration's findings SHALL return all of them, oldest first by `createdAt`. Findings SHALL NOT have replies or types.

#### Scenario: Findings in order
- **WHEN** findings F1, F2 and F3 are added to an exploration in that order
- **THEN** listing its findings returns `[F1, F2, F3]`

### Requirement: Editing and deleting findings
A finding's body SHALL be editable with a block batch that touches only blocks inside that body, and a successful edit SHALL set `editedAt`; the author and `createdAt` SHALL NOT change. Deleting a finding SHALL remove it with its whole body.

#### Scenario: Edit a finding
- **WHEN** a finding's paragraph is changed
- **THEN** the finding shows the new text and `editedAt` is set

#### Scenario: Delete a finding
- **WHEN** a finding is deleted
- **THEN** it is no longer listed and its body no longer exists

### Requirement: Findings stay with their exploration
Promoting an exploration SHALL leave its findings on the exploration and copy nothing into the new work. Deleting an exploration, directly or with its project, SHALL delete its findings in the same unit of work.

#### Scenario: Promote keeps findings in place
- **WHEN** an exploration with 2 findings is promoted
- **THEN** the exploration still has its 2 findings, and the new work task has no comments

#### Scenario: Delete an exploration with findings
- **WHEN** an exploration with findings is deleted
- **THEN** its findings and their bodies no longer exist
