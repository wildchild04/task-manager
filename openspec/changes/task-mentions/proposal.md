## Why

`@` mentions point at pages only. Tasks are what most notes talk about ("blocked by Add login", "see the passkeys exploration"), and "everything should be referenced" includes them. A task's description already is a page (a page block owned by the task), so a task can be mentioned with the same mention spans, as long as the app resolves and links it as the task.

## What Changes

- **Mentioning tasks:** the `@` menu lists tasks (any kind, any project) next to pages, each with "Task · kind · project". Choosing one inserts a mention of the task's description page.
- **Rendering:** a mention of a task's page shows the task's current title and opens `/tasks/:taskId`; renames follow, as for pages.
- **Linking to tasks:** the link dialog's `@` suggestions include tasks too (`/tasks/:taskId` links), and editing such a link or hovering it shows the task's title.
- **"Mentioned in" on task pages:** pages and other tasks that mention or reference a task are listed on its page, as on document pages.

## Capabilities

### New Capabilities
- (none)

### Modified Capabilities
- `page-viewer`: a mention of a task's description page renders as the task, linking to its page.
- `block-editor`: the `@` menu and the link dialog list tasks as well as pages.
- `task-screen`: a task's page shows where it is mentioned.

## Non-goals

- Mentioning blocks, comments, people or dates.
- Showing a task's state on its mention (title only).
- Mentions inside comments (comments are still plain text).

## External dependencies

None.

## Impact

- No model or schema change: a task mention is a page mention of the task's description page, which `block-tree` already allows.
- `app/blocks`: mention targets carry a title and a link (`MentionTargets`), resolved on the server; task-owned pages link to the task.
- `app/lib/page-search.server.ts`: search results include tasks and carry their link; `/api/pages` looks entries up by link.
- `app/lib/backlinks.server.ts`: backlinks of a task's description page, without the task itself; shown on the task page.
