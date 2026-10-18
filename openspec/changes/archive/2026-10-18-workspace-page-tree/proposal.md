## Why

The navigation's "Pages" group lists only the workspace's top-level pages, as a flat list. A page nested inside another workspace page (like the seeded "A sub-page" inside "Block showcase") can only be reached through the link inside its parent: it never appears in the sidebar, even while it's open. The project's knowledge library already shows its documents as a tree; workspace pages should behave the same.

## What Changes

- The "Pages" group shows the workspace's pages as a tree (`TreeNavigation`, as the library): top-level pages in order, each with the pages nested in it, at any depth.
- The open page is marked and its ancestors expanded; other branches start collapsed and keep their expansion while moving between pages.
- Every page in the tree keeps its delete action.

## Capabilities

### New Capabilities
- (none)

### Modified Capabilities
- `app-shell`: the "Pages" group is a tree of workspace pages, not a flat list of root pages.

## Non-goals

- Creating, renaming or moving workspace pages from the sidebar.
- Showing pages nested inside library documents anywhere new (the library tree already includes them).

## External dependencies

None (`TreeNavigation` is in the design system since v0.4.0).

## Impact

- `app/lib/shell.server.ts`: the shell view sends the workspace page tree.
- `app/routes/shell.tsx`: the "Pages" group uses the tree component the library uses (`LibraryTree`, renamed `PageTree` since it now serves both).
