## Why

A project's page stacks its description above six dashboard cards, so a written description pushes the dashboard down, and each card shows at most five items. Task pages already use a header plus tabs; the project page should match.

## What Changes

- A quick-glance header under the title: work to do / in progress / returned, open explorations and updates, chores with the next due time and how many are urgent.
- Tabs: Description (default) · Work · Explorations · Updates · Chores · Library, with counts; each lists the whole section (not five) and links to its full list. The tab is in the URL.
- The dashboard cards go away from this page; the dashboard registry still defines the sections.

## Capabilities

### Modified Capabilities
- `project-screens`: project home layout.

## Non-goals

- Filtering or quick-add inside the tabs (the list pages have them).
- Changing the dashboard registry or its sections.

## Impact

- `app/lib/projects.server.ts` (`projectHomeView`: glance and tab lists), `app/routes/project-home.tsx`; tests in `tests/app/screens.test.ts`. `DashboardCard` becomes unused.
