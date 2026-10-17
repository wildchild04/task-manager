## Why

Work and chores are things to act on, and acting on them surfaces unknowns. Comments hold the surrounding context: clarifications, findings, and, when an agent can't finish a piece of work, the explanation of why. The task's body page stays the current truth; comments are the conversation around it. Explorations and updates don't need comments because they are documents themselves.

## What Changes

- Introduce the **comment**: an entry on a `work` or `chore` task with an author (you or a named agent), timestamps, and a body made of **blocks**, so comments can contain lists, todos, code and references like any page.
- Comments on a task form a **flat list** ordered by creation time. There are no threads and no comment types.
- Comments can be **edited and deleted**. Deleting a comment removes its body; references to it resolve as missing.
- Register `comment` as a **referenceable entity kind**, so a comment that describes a problem or a gap can be the starting point of an exploration or update.
- **Returning work posts a comment**: `return` creates a comment by the returning actor containing the reason, in the same transaction as the state change and body-page update.

## Capabilities

### New Capabilities
- `task-comments`: comment entity, which kinds allow comments, block bodies, ordering, editing and deleting, referencing comments, and the comment posted by `return`.

### Modified Capabilities
<!-- None: block-data-model and task-core are not archived yet. Their in-flight specs were updated directly (the `comment` root block type in block-data-model). -->

## Non-goals

- Threads or replies, reactions, mentions, notifications.
- Comment types such as questions or resolvable comments.
- Comments on explorations, updates or knowledge library pages, and inline comments anchored to a block.
- Rules about which agent may edit or delete which comment. These belong to the agent workflows.
- UI.

## External dependencies

None. This change has no UI.

## Prerequisites

- `block-data-model`, including the `comment` root block type.
- `task-core`: tasks, kinds, actors, the referenceable entity registry and the `return` transition.

## Impact

- New code: `src/domain/comments/` (types, repository port, service, `comment` resolver) with SQLite and in-memory implementations.
- New migration: `comments` table.
- `task-core`'s `return` effect gains a comment-creation step.
- The block validator's protection hook extends to comment bodies, so they change only through the comment service.
