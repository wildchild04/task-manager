## Context

`task-core` defines tasks, actors, the unit of work and the referenceable entity registry. `block-data-model` has a `comment` block type, always an owned root, for comment bodies. This change adds the comment entity on top of both. The main design question is how comment bodies, which are ordinary block trees, are protected from being edited as if they were page content.

## Goals / Non-Goals

**Goals:**
- Comments with full block content, using the same blocks, references and (later) editor as pages.
- Comment bodies that change only through the comment service, so `editedAt` is always correct.
- `return` producing its comment atomically.

**Non-Goals:**
- Threads, comment types, inline block comments, notifications, agent permissions (see the proposal).

## Decisions

### 1. A comment is a row plus a block tree
`comments(id, task_id, body_block_id UNIQUE, actor_kind, actor_name, created_at, edited_at)`. The body is a `comment` root block whose children are the content. The row holds what blocks can't: the owning task, the author and the timestamps.

**Alternative considered:** making the comment itself the root block, with author and task in its props. Rejected: the task relationship and author need to be queryable and indexed, and block props are for content-level data.

### 2. Comment bodies are protected roots
`task-core` added a "protected" hook to the block validator's reader for task body pages. This change registers the `comment` owner kind with it: general block batches may not change a comment body or any block inside it. The comment service applies edit batches through a privileged path that first checks every operation stays inside that comment's tree, then sets `edited_at` in the same unit of work.

To find a block's root, the reader walks `parent_id` upwards. Comment bodies are shallow, so this is a few indexed lookups.

### 3. Ordering by creation time, not linked list
Comments are an append-mostly, flat list where the order is the creation order. Sorting by `created_at` (with `id` as a tiebreaker) needs no linked list, and comments can't be reordered by design.

### 4. Delete is a hard delete
Deleting removes the row and the body tree (a block `delete` of the comment root through the privileged path). Anything pointing at the comment or its blocks resolves as missing, consistent with how deleted blocks behave elsewhere. There's no comment trash, matching the rest of the model.

### 5. `return` composes the comment step into its effect
The `return` effect in `task-core` gains one step: create the comment (row plus body) using the comment service inside the same unit of work. The reason becomes the first paragraph, and any extra blocks given with `return` follow it. If any step fails, the whole unit of work rolls back.

### 6. The `comment` resolver
The referenceable registry gets a `comment` resolver returning `ok` with a summary (task ID, author, first paragraph's text) or `missing`.

## Risks / Trade-offs

- [Walking up to the root on every validated block operation adds reads] → Only needed for operations on blocks with a parent chain; page trees are rarely deep, and the check can stop at the first `page` or `comment` it reaches.
- [Hard delete loses context that an exploration referenced] → The reference shows as missing so the gap is visible. If this becomes a problem, a soft delete can be added to comments alone.
- [Anyone can edit or delete any comment, including an agent's] → Acceptable for a single user. Agent workflows will restrict what agents may do.

## Migration Plan

New `comments` table, in a migration numbered after `task-core`'s.

## Open Questions

- None for this change.
