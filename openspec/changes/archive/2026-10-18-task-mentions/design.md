## Decisions

### 1. A task mention is a mention of its description page
Tasks have no block of their own, but each has a body page (`task.bodyPageId`, a `page` block owned by the task) whose content is its title. Mentioning that page needs no new span kind and passes the existing validation (the target is a page). Resolution looks at the page's owner: a task owner turns the mention into the task (`/tasks/:taskId`, the task's title); any other page stays a page link. Backlinks of the task are the backlinks of its body page.

**Alternative considered:** `mention: { taskId }`. Cleaner on paper, but the block layer can't see tasks, so validation, resolution and backlinks would each need a cross-domain hook for the same result.

### 2. Mention targets carry their link
`MentionTitles` (page ID → title) becomes `MentionTargets` (page ID → `{ title, href } | null`), resolved on the server for read-only views and editable pages. The editor's mention element uses `href` and the title; inserting a mention adds its target from the menu's result.

### 3. One search for pages and tasks
Search results (`/api/pages`) become `{ id, title, place, href }`, where `id` is the page to mention (a task's body page for tasks) and `href` the link (`/pages/:id` or `/tasks/:id`). Tasks of every project and kind are searched by title; `place` is "Task · kind · Project". Lookups for showing a link's title (`?href=`) match by link, so `/tasks/…` links show the task's title in the link dialog and the hover card.

### 4. Backlinks on the task page
`pageBacklinks(services, task.bodyPageId)` with the task itself excluded (its own description is not a backlink), shown with the same `Backlinks` component after References.
