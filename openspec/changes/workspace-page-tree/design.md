## Decisions

### 1. One tree builder for workspace pages
`workspacePageTree(services)` builds `{ id, title, children }` nodes (the library's `LibraryNode` shape) from the root pages, loading each nested page's tree in turn (a loaded tree stops at nested pages), and finding nested pages anywhere in a page's blocks (inside toggles or lists too), in reading order. `allPages` in `page-search.server.ts` walks the same way and is rebuilt on it.

### 2. One tree component
`LibraryTree` already renders `LibraryNode`s with `TreeNavigation`, links through React Router, marks the active page, expands its ancestors when it changes, and takes a row action. It is renamed `PageTree` and used for both the project's library and the workspace pages, with the same delete action.

### 3. Shell view
`ShellView.pages` becomes the tree. The active page for the "Pages" group is the open `/pages/:id` (already derived in the shell).
