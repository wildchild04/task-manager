## Decisions

### 1. One view builder
`homeView(services, now)` returns plain data for the four sections: `attention: { items, more }`, `projects: [{ id, title, activeWork, openIdeas, urgentChores }]`, `pages: LibraryNode[]` (the existing workspace tree), `recent: [{ kind, title, place, href, edited }]`. It reads through the existing services; nothing is cached.

### 2. Needs attention
- Chores: `tasks.list(project, { kind: "chore", state: "todo" })` filtered by `chores.isUrgent`, ordered with the dashboard's `orderChores` (overdue, then urgent, then by due time). Reason: "Overdue" or "Urgent", plus the due time.
- Returned work: work in to do whose last history record is a `return` by an agent. Reason: "Returned by <name>".
- In progress: work in progress; reason: "In progress", plus "· <agent>" when the last `start` was by an agent.
Concatenated in that order, cut at 10.

### 3. "Last edited"
A page's or task's last edit is the latest `updatedAt` among the blocks of its own tree (title and content; sub-pages count separately), and for a task also its own `updatedAt` (state changes). Computed per item by loading its tree: fine at a single user's scale. Library documents, workspace pages (any depth) and tasks are candidates; the 8 latest are shown with their place ("Pages", "Project › Parent", or "Task · kind · Project") and a relative time ("2 h ago", "3 d ago", or the date beyond a week).

### 4. Layout
Two columns from `md` up (`ResponsivePanelGrid` 2 columns, stacked on small screens): left Needs attention then Projects (cards in a grid), right Pages then Recently edited. The header buttons reuse `NewPageDialog` and `NewProjectDialog`.
