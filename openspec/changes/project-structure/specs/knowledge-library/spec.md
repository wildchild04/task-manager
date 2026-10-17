## ADDED Requirements

### Requirement: Library is a page tree
Each project's knowledge library SHALL be the tree of `page` blocks under its library root. A document SHALL be a `page` in that tree; documents MAY be nested in other documents to any depth, and siblings SHALL keep the order given to them.

#### Scenario: Nested documents
- **WHEN** document "Architecture" is created in the library and "Auth design" is created inside it
- **THEN** the library tree is `Architecture → Auth design`

#### Scenario: Reorder documents
- **WHEN** the library has top-level documents `[A, B, C]` and C is moved after A
- **THEN** the top-level documents are `[A, C, B]`

### Requirement: Library tree for navigation
The system SHALL return a project's library tree containing only `page` blocks (each with ID, title and children, in order), at every depth, without the content blocks of each document.

#### Scenario: Content blocks are excluded
- **WHEN** document "Architecture" contains paragraphs and a nested document "Auth design"
- **THEN** the library tree shows "Architecture" with one child, "Auth design", and no paragraphs

### Requirement: Document operations
Documents SHALL be created, edited, moved and deleted through block batches, with the block-tree rules. Deleting a document SHALL delete its nested documents. A document MAY be moved into another project's library; references to it SHALL keep working.

#### Scenario: Delete a document with children
- **WHEN** "Architecture", which contains "Auth design", is deleted
- **THEN** neither document exists and the library tree no longer shows them

#### Scenario: Move a document to another project
- **WHEN** a document referenced by a task in project A is moved into project B's library
- **THEN** it appears in B's library tree, not in A's, and the task's reference still resolves to it

### Requirement: Which project a page belongs to
The system SHALL determine the project a page belongs to by walking up to its root and reading the root's owner (the project, for home pages and library documents; the task's project, for task body pages).

#### Scenario: Page of a library document
- **WHEN** the project of "Auth design" (nested under "Architecture" in project A's library) is requested
- **THEN** the result is project A
