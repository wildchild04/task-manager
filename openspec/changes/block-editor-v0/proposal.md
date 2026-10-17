## Why

Everything in the app is read-only: page bodies, library documents, a project's home page, task titles and task descriptions can only be written through seed data or the domain. The block model was built for an editor from the start (caller-generated IDs, every change a batch of operations), and the task and project screens are in place, so writing content is now the biggest gap. Agents will also need task descriptions written by the human to work from.

This is **v0**: the minimum that makes a block a block (its content and its type's function) and a document a document (creating, splitting, merging and nesting blocks), to be used, tested by hand and adjusted before settling a v1.

## What Changes

- **A block editor** with one editable area per block (Notion's model). The editor keeps its own copy of the page's blocks; every edit is a batch of the existing block operations, applied locally at once and saved to the server in the background.
- **Block types declare their editing behavior**, like task kinds declare theirs: whether they hold text, and what Enter, Enter on an empty block and Backspace at the start do. The editor core stays generic.
- **Layer 1, content:** typing and deleting text; marks with keyboard shortcuts (bold, italic, underline, strikethrough, code) and links.
- **Layer 2, type function:** todos check and uncheck; toggles open and close; sub-pages and page references open their page; dividers and references can't hold the caret.
- **Layer 3, structure:** Enter splits a block, with each type's rules (a heading continues as a paragraph, an empty list item leaves the list); Shift+Enter breaks a line inside a block; Backspace at the start turns a list item, todo, heading or quote back into a paragraph, then merges into the previous block; Tab and Shift+Tab nest and un-nest; ↑ ↓ move between blocks at their first and last lines.
- **Changing a block's type with markdown shortcuts** at the start of a block: `# `, `## `, `### `, `- `, `* `, `1. `, `[] `, `> `, and `---` for a divider.
- **Backspace never deletes a sub-page.** It steps over it to the previous block. References are removed by Backspace like text.
- **Undo and redo** (Cmd/Ctrl+Z, Shift+Cmd/Ctrl+Z), grouping a burst of typing into one step.
- **Saving:** typing is saved shortly after it pauses, structural edits at once; a "Saving…/Saved/Couldn't save" indicator, and a warning before leaving with unsaved edits.
- **Editable surfaces**, in order of difficulty: library documents and workspace pages (title and content), a project's home page, and a task's title and description.
- **Deleting a page:** a delete button at the top right of a page, and on library documents and workspace pages in the navigation, always behind a confirmation dialog that says how many pages inside it go too. Afterwards the browser goes to the parent page, the project's library, or the home route.

## Capabilities

### New Capabilities
- `block-editor`: editing a page's title and blocks in the browser: block type behaviors, content, type functions, structure, markdown shortcuts, undo and redo, saving, and which surfaces are editable.
- `page-deletion`: deleting a library document or workspace page (with the pages inside it) from the page and from the navigation, after a confirmation.

### Modified Capabilities
- `project-screens`: the project home page's content and a task's title and description become editable.

## Non-goals

- **Block selection** (Esc to select blocks, moving, duplicating and deleting blocks as units, drag handles): layer 4, a later change.
- **Slash menu and `@` references:** they wait for the design system's `InlineCommandMenu` (see External dependencies).
- **A "turn into" control** on each block. Markdown shortcuts are the only way to change a type in v0. Deferred, but to revisit if shortcuts feel bad in use.
- **Inserting sub-pages or references from the editor:** documents are created from the library page; references come with the `@` menu.
- **Comments in the editor:** comment bodies save through the comment service and new comments are drafts; that's the `comment-editor` change.
- **Clipboard beyond the browser's plain-text behavior** (copying blocks, pasting HTML or markdown as blocks), inline markdown (`**bold**`), Home/End across blocks, IME beyond common accented input, renaming from the navigation, moving documents, a trash.
- **Saving the open or closed state of toggles:** it's local to the page view.

## External dependencies

- **`InlineCommandMenu`** (`~/dev/design-system/feature-requests/inline-command-menu.md`, filed, open): a caret-anchored, non-modal menu that never takes focus, for the slash menu and `@` references. **Not required by v0**; the slash menu is deferred until it exists.

Everything in v0 uses existing components (`IconButton` with the `delete` icon, `Dialog`, `Checkbox`, `Typography`, `Link`, `Alert`) and the action slots of `TreeNavigation` and `PageNavigation`. The editable text itself is a native `contenteditable` element inside the app's block composites, as the composites already live in this repo.

## Prerequisites

- `block-data-model`, `project-ui`, `task-ui` (applied and archived).

## Impact

- New pure-TypeScript editor state in `src/editor/` (tree, selection, commands producing operations and their inverses, undo, save queue), tested in Vitest without a browser.
- New editable block components in `app/editor/`; the read-only renderers in `app/blocks/` stay for server rendering and non-editable views.
- Route actions on `/pages/:pageId`, `/projects/:projectId` and `/tasks/:taskId` accept edit batches, checked to stay inside the page being edited; `/pages/:pageId` also deletes pages.
- The shell's navigation gains delete actions; the page route gains the delete button.
- No database schema change. The domain gains a check that an edit batch stays within one page and doesn't delete a sub-page.
