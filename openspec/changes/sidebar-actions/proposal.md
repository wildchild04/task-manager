## Why

The navigation offered no way to create things (a project could only be created from the home route, a workspace page not at all), while every page row carried a delete button that cluttered it and made accidental deletion easy.

## What Changes

- The "Projects" heading links to the home route and has a **+** to create a project from anywhere; the new project opens.
- The "Pages" group is always shown and has a **+** to create a top-level workspace page; the new page opens, ready to edit.
- Delete buttons are removed from the navigation; pages are deleted from their own page (top right), as before.

## Capabilities

### Modified Capabilities
- `app-shell`: the navigation creates projects and workspace pages.
- `page-deletion`: no longer deletes from the navigation.

## Non-goals

- Creating library documents or nested pages from the navigation (the library page creates documents).
- Renaming from the navigation.

## Impact

- `app/routes/shell.tsx`, `app/components/new-project-dialog.tsx`, `app/components/new-page-dialog.tsx`, `app/lib/workspace-pages.server.ts`; the home route's action creates pages too.
- `app/components/delete-page.tsx` loses the navigation mode; `/api/pages?deletion=` and the page action's `stay` mode are removed.
