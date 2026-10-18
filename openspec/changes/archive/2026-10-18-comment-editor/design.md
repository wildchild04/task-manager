## Context

Comment bodies are `comment` root blocks owned by the comment; only `CommentService` may change them (`add` with a block tree, `edit` with a batch, which marks the comment edited). The block editor (`PageEditor`) edits a tree loaded from the server and saves batches to `/api/edits` per surface.

## Decisions

### 1. Existing comments: a `comment` surface
`/api/edits` gets `surface: "comment"`, `id: commentId`. The target root is the comment's body block, with no title. The batch goes through the same `checkPageEdit` (stays inside the comment; no page or comment blocks), then `comments.edit(id, batch)` instead of `blocks.apply`, so protection is respected and the comment is marked edited. The task page loads each comment's editable tree only when "Edit" is pressed (from `/api/comments/:id/editable`, a resource route), so a long thread doesn't ship editor data for every comment.

### 2. New comments: a draft editor
`PageEditor` gets a `draft` mode: it edits a local tree (a `comment` root with one empty paragraph), never saves, and hands the current state to the caller through `onDraftChange`. Posting serializes the root's children to `CommentBlockInput` trees (IDs, types, props, content, children) and submits `intent=comment-add` with `blocks` as JSON; the server validates the shape with the edit batch schema's block shape and calls `comments.add`, which rejects page/comment blocks and unknown mention targets. An empty draft (no text and no non-text blocks) is rejected with "The comment is empty". After a successful post the composer remounts with a fresh draft.

### 3. Shared editor pieces
Draft and comment editors reuse everything: block components, keyboard handling, slash and `@` menus, link dialog and hover card, undo. Differences are props: no title, an empty-state text ("Write a comment…"), no leave warning for drafts, and Cmd/Ctrl+Enter calling `onSubmit`.

### 4. Reading
`CommentView` gets `mentions` (the same `mentionTargets` used for pages), provided around each comment's blocks.
