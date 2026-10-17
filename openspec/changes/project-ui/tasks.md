## 1. Foundations

- [x] 1.1 Write the design-system feature requests (time picker, tree view) in `~/dev/design-system/feature-requests/` and reference them in the proposal
- [ ] 1.2 Add shared view helpers: due-time formatting in the workspace time zone, `describeSchedule`, state labels and chip colours per kind
- [ ] 1.3 Add form helpers: reading form data, mapping domain errors to field errors, the `{ fieldErrors, values }` action result
- [ ] 1.4 Extend `buildPageView` to project home pages and library documents (with the owning project), keeping task and comment roots excluded

## 2. Shell and projects home

- [ ] 2.1 Shell loader and view: projects group, current project's sections (from the route, a task or a page), "Pages" group
- [ ] 2.2 Projects home view and the create-project action (redirect on success, error on empty title); empty state
- [ ] 2.3 Routes: `/`, `/projects/:projectId` registered in `app/routes.ts`

## 3. Project home and dashboard

- [ ] 3.1 Project home view: title, home page view, dashboard sections with formatted chore items; 404 for unknown projects
- [ ] 3.2 Dashboard card components (counts, item links, urgent marker, due time, empty state)

## 4. Task lists and creation

- [ ] 4.1 Task list view per kind with the URL filter, columns and chore order
- [ ] 4.2 Create actions: quick add (explorations, work), update dialog (done work picker, unavailable when none), chore dialog (urgency and all five schedule types)
- [ ] 4.3 Task list route and components (table, tabs, quick-add row, dialogs, inline errors)

## 5. Library and task overview

- [ ] 5.1 Library view (nested tree) and create-document action (top level or inside a document, appended last)
- [ ] 5.2 Task overview view and route (`/tasks/:taskId`), including chore urgency, schedule in words and due time; 404 for unknown tasks
- [ ] 5.3 Page viewer route: back link to the owning project for library documents

## 6. Seed and verification

- [ ] 6.1 Seed the sample project per part (idempotent; adds the project to older databases)
- [ ] 6.2 Tests: every scenario in project-screens, app-shell, page-viewer and dev-data through the view builders and action handlers, plus rendering tests for the dashboard card and chore form
- [ ] 6.3 `typecheck`, tests and `build` pass; run the app and check every screen in the browser
