## 1. Prerequisites

- [ ] 1.1 Confirm `block-data-model` (with the `comment` root type) and `task-core` are applied
- [ ] 1.2 Register the `comment` owner kind with the block protection hook (no changes from general batches), with a privileged path for the comment service

## 2. Domain

- [ ] 2.1 Define `Comment` and the `CommentRepository` interface (create, get, list by task, set edited, delete) in `src/domain/comments/`
- [ ] 2.2 Implement `CommentService.add`: check the task kind (work or chore), create the row and `comment` root body in one unit of work, reject `page`/`comment` blocks in the body
- [ ] 2.3 Implement `CommentService.edit`: check every operation stays inside the comment's tree, apply through the privileged path, set `editedAt`
- [ ] 2.4 Implement `CommentService.delete`: remove the row and the body tree
- [ ] 2.5 Register the `comment` referenceable kind with its resolver

## 3. Persistence

- [ ] 3.1 Write the `comments` migration with indexes on `(task_id, created_at)` and unique `body_block_id`
- [ ] 3.2 Write the shared contract suite covering every scenario in the task-comments spec
- [ ] 3.3 Implement the in-memory and SQLite repositories and pass the suite with both

## 4. Return integration

- [ ] 4.1 Add the comment step to `task-core`'s `return` effect (reason as first paragraph, then extra blocks)
- [ ] 4.2 Test that a failing comment step leaves the work `in_progress` with no comment, body change or history entry
- [ ] 4.3 Confirm `typecheck` and the full test suite pass
