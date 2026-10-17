## 1. Project setup

- [x] 1.1 Create `package.json` (type: module), strict `tsconfig.json`, and Vitest config; add `typescript`, `vitest`, `better-sqlite3`, `@types/better-sqlite3`, `zod`
- [x] 1.2 Add `typecheck` and `test` scripts and confirm an empty test run passes
- [x] 1.3 Create the `src/domain`, `src/infra/memory`, `src/infra/sqlite`, `db/migrations` and `tests/contract` folders

## 2. Domain types and validation

- [x] 2.1 Define `Block`, `BlockType`, `RichText` spans and marks, `Operation` (insert/update/move/delete) and `Batch` in `types.ts`
- [x] 2.2 Write zod schemas per block type in `schema.ts`: props, and whether the type carries content
- [x] 2.3 Define the read-only `BlockReader` used by validation (get block, get children, is-descendant check)
- [x] 2.4 Implement `validateOperation(op, reader)`: duplicate IDs, unknown types, props/content validation, parent and owner rules (only pages and comments are roots, comments are always owned roots, owner set only at insert, owned roots can't move, leaf types have no children), and the owner-kind protection hook, "after" must be a sibling, no move into own descendant, turn-into rules, reference target exists and isn't itself
- [x] 2.5 Define a `BatchError` carrying the failing operation index and reason
- [x] 2.6 Unit-test `validateOperation` against a small in-memory reader fixture

## 3. Repository port and contract tests

- [x] 3.1 Define the `BlockRepository` interface: `getBlock`, `getChildren`, `loadTree`, `getOwnedRoots`, `listIncomingReferences`, `apply`
- [x] 3.2 Write the shared contract suite as a function taking a repository factory; cover every scenario in the block-tree, block-references and block-repository specs
- [x] 3.3 Add an order-integrity test hook (per implementation) that corrupts stored order, used by the integrity scenario

## 4. In-memory implementation

- [x] 4.1 Implement `MemoryBlockRepository` storing rows with `parentId` and `prevId`, with copy-on-write batches so a failure leaves state untouched
- [x] 4.2 Implement linked-list insert, move and delete, and ordered reads with gap and loop detection
- [x] 4.3 Implement `loadTree` for page and comment roots (stopping at nested pages), `getOwnedRoots`, and `listIncomingReferences`
- [x] 4.4 Run the contract suite against it until it passes

## 5. SQLite implementation

- [x] 5.1 Write `001_blocks.sql`: `blocks` table (`id`, `type`, `parent_id`, `prev_id`, `owner_kind`, `owner_id`, `props`, `content`, `target_id`, `created_at`, `updated_at`), the partial unique `(COALESCE(parent_id,''), COALESCE(prev_id,''))` index `WHERE owner_kind IS NULL`, an index on `(owner_kind, owner_id)`, and indexes on `parent_id` and `target_id`
- [x] 5.2 Implement the migration runner (numbered files, applied once, recorded in a migrations table)
- [x] 5.3 Implement `SqliteBlockRepository.apply` in one transaction, with statement order that keeps the unique index valid (including the detached-sentinel move)
- [x] 5.4 Implement ordered `getChildren` and the recursive-CTE `loadTree` with integrity checks
- [x] 5.5 Implement `listIncomingReferences` using `target_id`
- [x] 5.6 Run the contract suite against it, using a temporary database file per test, until it passes
- [x] 5.7 Add the close-and-reopen persistence test

## 6. Service, references and composition

- [x] 6.1 Implement `BlockService` over the port (apply batch, load page, list root pages)
- [x] 6.2 Implement `resolveReference(ref, expansionPath, reader)` returning `ok`, `missing` or `cycle`, with unit tests for the direct and indirect cycle scenarios
- [x] 6.3 Add `composition.ts` that builds the service with the SQLite repository, and a test helper that builds it with the in-memory one
- [x] 6.4 Confirm `typecheck` and the full test suite pass
