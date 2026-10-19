## Why

The home route is a grid of project titles, and workspace pages only live in the sidebar. Opening the app doesn't answer the first questions: what needs me now, across every project, and where was I? With agents working tasks, "what came back from an agent" is one of those questions.

## What Changes

The home route becomes a dashboard combining projects and pages:

- **Header**: "Home" with **New page** and **New project**.
- **Needs attention** (across all projects): urgent or overdue chores, work returned by an agent (with who returned it), and work in progress (with the agent holding it). At most 10, most pressing first, with "N more".
- **Projects**: one card per project with live counts (active work, open ideas, urgent chores), linking to the project.
- **Pages**: the workspace page tree, or an empty state offering a new page.
- **Recently edited**: the 8 pages and tasks changed most recently, anywhere, with their place and when.

## Capabilities

### Modified Capabilities
- `project-screens`: the home route is a dashboard of projects and pages (replacing "Projects home").

## Non-goals

- Configurable or reorderable sections; per-user preferences.
- Activity feeds of every change (only the latest edit per item).
- Charts or metrics over time.

## External dependencies

None. Uses `Card`, `List`, `Chip`, `Link`, `Button`, `ResponsivePanelGrid`, `Typography`, `Alert` and the app's `PageTree`.

## Impact

- `app/lib/home.server.ts`: the dashboard view builder (tested); `app/routes/home.tsx`: the layout.
- No domain or schema change.
