## Context

The app (React Router 7 framework mode, SSR) has a shell listing workspace pages and a read-only page viewer. The domain now has projects, a knowledge library, tasks of four kinds, chores with schedules, comments and a dashboard, all reachable through `AppServices` from `app/lib/services.server.ts`. This change adds the screens for the project half; the task page's actions follow in `task-ui`.

## Goals / Non-Goals

**Goals:**
- Projects, their dashboards, task lists and library usable end to end in the browser.
- Thin routes: screen logic is testable without a browser or a router.
- Forms that work as plain HTML posts, enhanced by React Router.

**Non-Goals:**
- Task actions, comments, references and lineage in the UI; page editing; renames, moves and deletes (see the proposal).

## Decisions

### 1. Thin routes, tested view and action modules
Each screen has a server module in `app/lib/` with two kinds of functions, both taking `AppServices`:
- **view builders** (`projectHomeView(services, projectId)`, `taskListView(services, projectId, kind, filter)`, …) that return plain, serializable data
- **action handlers** (`createTask(services, projectId, kind, formData)`, …) that validate form data, call the domain, and return either a result or field errors

Route `loader`s and `action`s only call these with `services` and the request. Vitest runs the builders and handlers against `createInMemoryServices()`, so every scenario is tested without rendering. Components get data through `loaderData` and `actionData` only, as `app-scaffold` established.

**Alternative considered:** testing routes end to end with a browser. Deferred: it's slower and needs a browser runner; the view/action split covers the logic, and a few rendering tests cover components.

### 2. Forms post to route actions with an `intent`
Creation uses React Router `<Form method="post">` (or `useFetcher` for dialogs), with a hidden `intent` field when a route has more than one action (e.g. `create-document`). Design-system inputs are given `name`s so the form data is complete without client state. After a successful create, the action redirects (project creation) or returns `{ ok: true }` so the dialog closes and the list revalidates. Errors come back as `{ fieldErrors, values }` so the form keeps its input.

### 3. IDs are generated on the server
Actions generate task, project and document IDs with `crypto.randomUUID()`. The domain's caller-generated IDs are kept for the future editor, which will need to reference a block before it's saved.

### 4. Domain errors map to field errors
`TaskError`, `ProjectError` and `BatchError` validation messages are mapped to the field they concern (title, time, schedule field) or a form-level message. Schedule fields are parsed from form data into a `Schedule` before reaching the domain, so most errors are caught with a precise field name; the domain's zod validation remains the source of truth.

### 5. Times are formatted on the server in the workspace time zone
View builders format due times with `Intl.DateTimeFormat` in `services.tasks.timeZone` and send strings (and the raw ISO value for sorting), so server and client render the same text and hydration can't disagree. Schedules are described in words by one helper (`describeSchedule`): "Every Monday at 09:00", "Every 6 hours", "On 3 Nov 2026 at 14:30", "30 minutes after creation", "At 09:00".

### 6. Navigation is two flat groups plus the current project
`PageNavigation` is flat, so the shell's navigation is a stack: the projects group, the current project's sections (when a project, task or document is open), and the "Pages" group. The shell loader finds the current project from the route: the `projectId` param, a task's project, or a page's project through `LibraryService.projectOfPage`. The library tree is shown on the library page, not in the navigation, until a tree component exists.

### 7. Page viewer scope
`buildPageView` accepts pages whose root is a workspace page or is owned by a project (`project` owner kind), and returns the owning project for a back link. Task and comment roots stay excluded. The task overview renders a task's body by building the same view from the body page directly.

### 8. Filters live in the URL
Task list filters are a `?state=` search parameter (`open`, `tombstoned`, `promoted`, `active`, `done`, `cancelled`, `todo`, `all`), defaulting per kind. `Tabs` change the parameter with a navigation, so the server renders the filtered list.

### 9. Seed by part
`scripts/seed.ts` checks the workspace pages and the sample project separately, so databases seeded before this change get the project added. The sample project is built through the services (projects, tasks, transitions, chores, comments), so it is valid by construction. It uses a fixed project ID (`seed-project`) and generated IDs for the rest.

## Risks / Trade-offs

- [The HH:MM text field is a weaker input than a time picker] → Server validation with a clear message; replaced when the design system ships a time picker (feature request).
- [Library depth isn't visible in the navigation] → The library page shows the full tree; the tree view feature request brings it into the navigation later.
- [Dashboard and lists recompute on every request] → Single user with small data; the domain queries are indexed.
- [Pages remain read-only] → Expected until the editor; titles of new tasks and documents are set at creation.

## Migration Plan

No data migration. Run `npm run db:seed` to add the sample project to an existing local database.

## Open Questions

- Should the projects home also show a cross-project summary (all urgent chores, all returned work)? Assumed not in this change.
