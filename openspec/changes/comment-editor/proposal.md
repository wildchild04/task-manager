## Why

Comments are still plain text: a textarea where blank lines become paragraphs, and editing replaces the whole comment with paragraphs (losing anything else). Comment bodies are already block trees, so they can hold everything pages hold, and the block editor, `@` mentions and links now exist. Agents' return reasons and the human's notes on work deserve the same writing tools as task descriptions.

## What Changes

- **New comments** are written with the block editor: formatting, lists, todos, quotes, toggles, links, `@` mentions of pages and tasks, the slash menu and markdown shortcuts. The draft stays in the browser until "Comment" (or Cmd/Ctrl+Enter) posts it as one comment; the editor then clears.
- **Editing a comment** happens in place: "Edit" turns the comment into an editor that saves as you type (through the comment service, so the comment is marked edited); "Done" turns it back. The plain-text edit dialog and its "formatting will be lost" warning go away.
- **Reading comments** renders marks, links and mentions like page content.
- Page and comment blocks can't be created inside a comment (as before).

## Capabilities

### New Capabilities
- (none)

### Modified Capabilities
- `task-screen`: comments are written and edited with the block editor, and render mentions.
- `block-editor`: comments are an editable surface (drafts not saved until posted; existing comments saved through the comment service).

## Non-goals

- Replies or threads; reactions.
- Mentions in comments counting as backlinks ("Mentioned in" still lists pages and tasks only).
- The return dialog's reason (stays a plain text field).

## External dependencies

None.

## Impact

- `app/editor/page-editor.tsx`: a draft mode (no saving, content handed to the caller) and a `comment` surface; an empty-state text that fits comments.
- `app/lib/page-edit.server.ts`: the `comment` surface, applied through `CommentService.edit`.
- `app/lib/task-actions.server.ts`: `comment-add` accepts the editor's blocks (JSON); the plain-text edit path is removed.
- `app/components/task-comments.tsx`: the composer and in-place editing; read-only comments get their mention targets.
