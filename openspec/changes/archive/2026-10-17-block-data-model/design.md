## Context

The repository is empty apart from OpenSpec. This change sets up the foundation that everything else builds on: the block model, its operations and its persistence. Later changes (the keyboard-navigation spike, the editor, database properties and views) consume it through the domain service and the `BlockRepository` port.

Constraints from the project context: single user with one SQLite database and no sync; strict TypeScript, SQLite via better-sqlite3, Vitest; domain depends only on interfaces; every repository has an in-memory implementation; no app framework yet.

## Goals / Non-Goals

**Goals:**
- One model for all content: typed blocks in an ownership tree, with references for anything shared.
- Cheap insert and move, using a linked list for sibling order.
- One set of invariants, enforced identically by both repository implementations.
- Persistence that can be replaced without touching the domain.

**Non-Goals:**
- Properties, databases, views, rendering, editing behaviour, sync, trash. See the proposal.

## Decisions

### 1. Sibling order is a singly linked list on `prev_id`
Each block row stores `prev_id`: the ID of the sibling directly before it, or `NULL` for the first child. The domain only ever sees ordered arrays; the linked list exists only inside the repositories.

- **Insert after `A`:** point `A`'s current successor at the new block, then insert the new block with `prev_id = A`. Two row writes.
- **Move:** detach (successor takes over the block's old `prev_id`), then attach at the new position. At most four row writes, independent of list length.
- **Delete:** successor takes over the deleted block's `prev_id`; the subtree is removed.
- **Read:** fetch all children of a parent, index them by `prev_id`, and walk from the `NULL` head.

A unique index on `(COALESCE(parent_id, ''), COALESCE(prev_id, ''))` makes the database itself reject a fork (two blocks after the same sibling) or a second head. It is a partial index (`WHERE owner_kind IS NULL`), because owned roots are unordered and all have a `NULL` parent and `NULL` `prev_id`. SQLite checks unique indexes per statement, so writes are ordered to keep it valid after every statement. A move first parks the block under a reserved sentinel parent (`'__detached__'`), relinks both neighbourhoods, then sets its final parent and `prev_id`.

**Alternatives considered:**
- *Integer positions:* simple reads (`ORDER BY`), but an insert renumbers every later sibling.
- *Fractional index keys* (`"a0"`, `"a0V"`): one row per insert or move and `ORDER BY` works, but keys grow under repeated inserts at the same spot and need occasional rebalancing. Their main advantage, merging concurrent inserts from several writers, doesn't apply to a single-user app with one database.
- *Doubly linked list:* gives redundancy for detecting corruption, but doubles the writes per change. The unique index plus walk validation is enough.

### 2. Ownership and references are separate relations
`parent_id` forms a strict tree: each block has exactly one owner, and deleting the owner deletes the block. References are a graph on top: a `reference` block stores `targetId` in its props, and the repository mirrors it into an indexed `target_id` column for backlink queries. `target_id` has no foreign key, so a reference can outlive its target and resolve as `missing`.

This keeps "where does this block live" unambiguous, which delete, move and page loading depend on, while still allowing a page to show content that lives elsewhere. Later features (linked pages, embedded database views, synced blocks, mentions) are expected to be new reference kinds rather than exceptions to the tree.

**Alternative considered:** allowing a block to have several parents (a DAG). Rejected: delete and move semantics become ambiguous, and loading a page could repeat the same subtree.

### 3. Validation lives in the domain; repositories call it inside their transaction
`src/domain/blocks/validate.ts` exports `validateOperation(op, reader)`, where `reader` is a read-only view of the current state (including earlier operations in the batch). Both repositories run the batch inside a transaction: for each operation they call the validator, then perform the writes. A thrown validation error rolls back the transaction and is reported with the operation index.

This puts all rules in one place, and the shared contract suite proves both implementations enforce them identically.

The linked-list writes and ordered reads are also written once, in `src/infra/shared/`, over a small synchronous `RowStore` interface that each implementation provides. The write order there is the one SQLite's unique index needs, and the in-memory store simply follows it. Linked-list pointers stay inside infrastructure; the domain only sees ordered arrays.

**Alternative considered:** the service validates and the repository writes blindly. Rejected: validation needs reads that must happen inside the same transaction as the writes, so the service would have to manage transactions and the port would grow a transaction API.

### 4. Block props and content are validated with zod
A discriminated union on `type` defines each type's props schema and whether it carries content. Both are stored as JSON text columns in SQLite. Rich text uses our own span format (`{ text, marks? }`), not an editor library's JSON, so the future `RichText` primitive converts at its boundary and the editor library can be replaced.

### 5. IDs are caller-generated UUIDs
`crypto.randomUUID()`. Generating IDs on the caller side lets the editor create a block, focus it and reference it before the batch is persisted.

### 6. Loading a tree uses one recursive query
A recursive CTE selects the root's descendants and stops descending at nested `page` blocks. Rows are grouped by `parent_id` and each group is ordered by walking its linked list. A walk that does not visit every row in the group, visits a row twice, or finds no head raises an order-integrity error naming the parent.

### 7. Layout
```
src/domain/blocks/
  types.ts              Block, BlockType, RichText, Operation, Batch
  schema.ts             zod schemas per block type
  validate.ts           validateOperation(op, reader)
  references.ts         resolveReference(ref, expansionPath, reader)
  block.repository.ts   BlockRepository interface (port)
  block.service.ts      BlockService (depends on the port only)
src/infra/shared/      row-store.ts (RowStore interface), apply-batch.ts (linked-list writes),
                       rows.ts (ordered reads, tree building, integrity checks)
src/infra/memory/memory-block.repository.ts   RowStore over a Map, copy-on-write batches
src/infra/sqlite/sqlite-block.repository.ts   RowStore over better-sqlite3, recursive CTEs
src/infra/sqlite/migrate.ts
src/composition.ts      chooses the implementation
db/migrations/001_blocks.sql
tests/contract/block-repository.contract.ts   run once per implementation
```

### 8. Workspace roots and owned roots
A root block is either a **workspace root page** (ordered among the workspace's root pages) or an **owned root**: a `page` or `comment` whose owner is an entity outside the block tree, stored as `owner_kind` and `owner_id` columns. Task body pages, a project's home page and library root, and comment bodies are all owned roots. They're found through their owner, not by browsing, and never appear among the root pages. The block layer treats `owner` as opaque; each owning domain validates its own owners and decides what may change its roots (see the protection hook in decision 9).

Treating comment bodies and task pages as block trees means they get every block type, references and the same editor, with no second content format.

**Alternative considered:** storing comment bodies as Markdown text. Rejected: comments must support blocks, and a second format would need its own rendering, editing and referencing.

### 9. Repositories can join an outer transaction
`task-core` needs a task and its body page to be written together, so the block repositories must be constructible inside a shared unit of work. In SQLite, `apply` uses a better-sqlite3 transaction function, which nests as a savepoint when an outer transaction is open. The validator's reader also exposes a protection hook keyed by owner kind: each owning domain registers which operations on its owned roots and their descendants general batches may perform (for example, task body pages can be edited but not deleted, comment bodies can't be changed at all outside the comment service). Neither changes this change's spec.

## Risks / Trade-offs

- [A bug or a manual edit corrupts a linked list, making blocks unreachable] → The unique index blocks forks and double heads at write time; reads detect gaps and loops and fail loudly. A repair tool (append unreachable blocks at the end) can follow if this ever happens.
- [The same user edits one page in two browser tabs, and one tab acts on a stale view] → SQLite transactions serialize the batches, and validation re-checks every operation against current state (the "after" block must still be a sibling, the parent must still exist), so a stale batch is rejected rather than corrupting order. The tab reloads the page and retries.
- [Reading one sibling's position needs the whole sibling list] → Pages load whole anyway; no feature reads a single position without its siblings.
- [Deleting a large subtree is one big transaction] → Acceptable for single-user SQLite; revisit only if trash or soft delete is added.
- [Numbered-list numbering is not stored] → It's derived at render time from consecutive `numbered_list_item` siblings, which is intended: storing it would need renumbering on every edit.

## Migration Plan

New project, nothing to migrate. Migration `001_blocks.sql` creates the `blocks` table and its indexes.

## Open Questions

- Should toggle open/closed state be persisted, and is it per block or per user? (Assumed: UI state, not stored, in v1.)
- Do blocks need `created_at` / `updated_at` now? (Assumed: yes, cheap to add, useful for tasks later.)
- What does the workspace root look like once there are several workspaces or users? (Assumed: a single implicit workspace; root pages have `parent_id NULL`.)
