## Why

Lists of tasks and tickets grow long (a shift's tickets, a container's work across sub-projects), and only the work and explorations lists can be searched, through their quick-add row, which matches only the title, the state and the sub-project. Finding a ticket by severity or ID, an urgent chore, or an experiment by its hypothesis means scrolling.

## What Changes

- Every task list page (`/projects/:projectId/<list>`: work, explorations, updates, chores, tickets, experiments) gets a Cloudscape property filter. Free text matches the title, state, ticket ID, severity, hypothesis, urgency and sub-project; properties filter on Title, State, and, where the list has them, Ticket ID, Severity, Hypothesis, Urgency and the sub-project (or root cause), with "and"/"or" between filters. The filter is part of the URL (`?f=`, `?join=or`) and is kept when the state filter changes; the header counts the matches.
- **BREAKING (UI):** the quick-add row on the work and explorations lists is removed; "New work" and "New exploration" in the header open the create dialog, as on the other lists.
- Each project home task tab gets a search box over its items and its completed items (title, state or marker, detail, ticket ID). The text is part of the URL (`?q=`) and applies to every task tab.
- The home page's Needs attention, Waiting for review and Recently edited lists each get a search box. Needs attention searches everything that needs attention and then shows at most 10 matches with how many more; the loader now sends all items.

## Capabilities

### Modified Capabilities
- `project-screens`: searching every task list, project home tab and home page list; creating from a list only through its "New" button.

## Non-goals

- Server-side search, or searching task descriptions, comments or diagnostics.
- Searching beyond the 8 items "Recently edited" shows.
- Saved filters, or filter sets shared between list pages.
- Searching the navigation, the library tree or the sub-projects tab.
- Changing the state filters (they stay a segmented control, and State is also a filter property).

## Cloudscape gaps

None: PropertyFilter on the list pages and TextFilter on the project home tabs and home lists. The app has no I18nProvider, so the PropertyFilter's i18n strings are passed in.

## Impact

- New `app/lib/list-search.ts` (matching, URL encoding, PropertyFilter strings) and `app/components/search-box.tsx`; `app/routes/task-list.tsx`, `app/routes/project-home.tsx`, `app/routes/home.tsx`; `app/lib/home.server.ts` (`attention` becomes `{ items, limit }` with all items).
- Unit tests for matching and encoding; home and on-call shell tests for the attention shape; e2e for each kind of list.
