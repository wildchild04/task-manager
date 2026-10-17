## Why

Every feature planned for this app (pages, the block editor, tasks, database views) reads and writes the same thing: a tree of typed blocks. Getting this model right first gives the editor, keyboard-navigation spike and later database features a stable contract to build on, and lets persistence be swapped without touching the domain.

## What Changes

- Introduce the **block** as the single unit of content: a typed record with a stable ID, type-specific props, rich-text content and exactly one owner (`parentId`). A page is a block of type `page`; its children are its content.
- Define a minimal v1 set of **block types**: `page`, `paragraph`, `heading`, `todo`, `bulleted_list_item`, `numbered_list_item`, `toggle`, `quote`, `divider`, `reference`, and `comment` (the root of a comment's body, so comments can contain blocks).
- Introduce **owned roots**: a root page or comment owned by an entity outside the block tree (a task, a project, a comment). Owned roots are not browsable workspace pages and are found through their owner.
- Store **sibling order as a linked list** (each block points at its previous sibling). The domain never sees pointers: reading a parent's children returns an ordered array.
- Introduce **references**: a `reference` block points at another block by ID instead of owning it. This is how a page will later embed content that lives elsewhere (a linked page, a database view, a synced block) without nesting ownership.
- Define the **operation set** that is the only way to change blocks: `insert`, `update`, `move`, `delete`, applied as an atomic batch.
- Define a **`BlockRepository` interface** (port) with two implementations: SQLite (better-sqlite3) and in-memory. Both must pass the same contract test suite.
- Set up the project skeleton the model needs: TypeScript (strict), Vitest, better-sqlite3, SQL migrations.

## Capabilities

### New Capabilities
- `block-tree`: block identity, types, ownership tree, sibling ordering, the operation set and its invariants.
- `block-references`: reference blocks, resolving a reference, and behaviour for missing targets and reference cycles.
- `block-repository`: the persistence port, its SQLite and in-memory implementations, atomic batches, and loading a page as an ordered tree.

### Modified Capabilities
<!-- None: this is the first change in the project. -->

## Non-goals

- Database properties (status, date, tags…), databases and views. These come in later changes, one at a time.
- Rendering, the block editor, keyboard navigation (covered by a separate spike), and rich-text editing behaviour. The model stores rich text as data only.
- Collaboration, multi-user access and sync. The app is single user by design, not as a v1 shortcut.
- Trash / soft delete and version history.
- Choosing the app framework.

## External dependencies

None. This change has no UI and needs no design-system components.

## Impact

- New project files: `package.json`, `tsconfig.json`, Vitest config, `db/migrations/`.
- New code: `src/domain/blocks/` (types, operations, repository interface, service) and `src/infra/sqlite/`, `src/infra/memory/` (implementations).
- New dependencies: `better-sqlite3`, `typescript`, `vitest`, `zod` (block schema validation).
