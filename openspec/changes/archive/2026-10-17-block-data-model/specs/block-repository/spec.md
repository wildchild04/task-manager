## ADDED Requirements

### Requirement: Repository interface
The domain SHALL access blocks only through a `BlockRepository` interface. Domain code SHALL NOT import a concrete implementation. The interface SHALL provide:
- `getBlock(id)`: one block, or not found
- `getChildren(parentId | null)`: ordered children of a block, or the ordered workspace root pages (never owned roots)
- `loadTree(rootId)`: a page or a comment and its content as an ordered tree
- `getOwnedRoots(owner)`: the owned roots of an owner entity
- `listIncomingReferences(targetId)`: reference blocks pointing at a block
- `apply(batch)`: apply a batch of operations atomically

Callers SHALL receive children as ordered arrays and SHALL NOT see how order is stored.

#### Scenario: Domain service works with any implementation
- **WHEN** the block service is constructed with the in-memory repository, then with the SQLite repository
- **THEN** it behaves the same with both, with no change to the service

### Requirement: Two implementations with a shared contract
There SHALL be a SQLite implementation (better-sqlite3) and an in-memory implementation. A single contract test suite covering the block-tree, block-references and block-repository requirements SHALL run against both, and both SHALL pass it.

#### Scenario: Contract suite runs against both
- **WHEN** the test suite runs
- **THEN** every contract test is executed once per implementation and passes for each

### Requirement: Loading a tree
`loadTree(rootId)` SHALL accept a `page` block (root or nested) or a `comment` root, and SHALL return it and all its descendants as a tree with children in order. A nested `page` block SHALL be returned as a node without its children, since it is a separate page loaded on its own. Reference blocks SHALL be returned as-is, without resolving their targets.

#### Scenario: Nested content in order
- **WHEN** a page has children `[H, T]` and toggle `T` has children `[A, B]`
- **THEN** `loadTree` returns the page with children `[H, T]` and `T` with children `[A, B]`

#### Scenario: Sub-pages are not expanded
- **WHEN** a page contains a child page S that has its own content
- **THEN** `loadTree` returns S without its children

#### Scenario: Missing page
- **WHEN** `loadTree` is called with an ID that does not exist, or is neither a `page` nor a `comment`
- **THEN** it returns not found

#### Scenario: Load a comment body
- **WHEN** `loadTree` is called with a `comment` root that has a paragraph and a todo
- **THEN** it returns the comment root with those two children in order

#### Scenario: Owned roots are not root pages
- **WHEN** owned roots exist (a task's body page, a comment body) and `getChildren(null)` is called
- **THEN** none of them are in the result

### Requirement: Durable persistence
The SQLite implementation SHALL persist every applied batch, so that blocks, order and references are unchanged after the database is closed and reopened. The schema SHALL be created and evolved only through numbered SQL migration files.

#### Scenario: Survives reopen
- **WHEN** a batch is applied, the database is closed, and it is opened again
- **THEN** `loadTree` returns the same tree as before closing

#### Scenario: Fresh database
- **WHEN** the repository is opened on an empty database file
- **THEN** migrations run and the repository is usable with no root pages

### Requirement: Order integrity is detected
If the stored order of a parent's children is inconsistent (a block cannot be reached, two blocks claim the same position, or the order loops), reading those children SHALL fail with an order-integrity error naming the parent, rather than silently dropping or duplicating blocks.

#### Scenario: Corrupted order
- **WHEN** the stored order for parent P is altered outside the repository so that one child is unreachable
- **THEN** `getChildren(P)` and `loadTree` of P's page fail with an order-integrity error naming P
