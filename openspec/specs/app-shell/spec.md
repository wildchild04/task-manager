# app-shell Specification

## Purpose
TBD - created by archiving change app-scaffold. Update Purpose after archive.
## Requirements
### Requirement: Development server
`npm run dev` SHALL start the app with server-side rendering and hot reload, using the local SQLite database (migrated on start). `npm run build` followed by `npm start` SHALL serve the same app in production mode.

#### Scenario: Start the dev server
- **WHEN** `npm run dev` is run on a fresh checkout after `npm install`
- **THEN** the app is served locally, the database file is created and migrated, and the home page renders without errors

### Requirement: Server boundary
Domain services SHALL be created once per server process from `src/composition.ts` in a server-only module, and only route loaders and actions SHALL call them. Components SHALL receive data through loaders and SHALL NOT import domain services, repositories or `better-sqlite3`.

#### Scenario: Services are not bundled for the browser
- **WHEN** the app is built
- **THEN** the client bundle contains no `better-sqlite3` or repository code

#### Scenario: One database connection in development
- **WHEN** a route module is hot-reloaded in development
- **THEN** the existing services and database connection are reused rather than opening a new connection

### Requirement: Design system and theme
The app SHALL render inside the design system's provider. The theme mode (light or dark) SHALL be kept in a cookie and read by the root loader, so the server renders the chosen mode and there is no flash of the other mode. A theme toggle in the shell SHALL switch the mode.

#### Scenario: Mode survives reload
- **WHEN** dark mode is selected and the page is reloaded
- **THEN** the server-rendered page is already in dark mode

### Requirement: App shell and navigation
Every page SHALL render inside an app shell whose navigation lists the workspace's root pages in order, each linking to `/pages/:pageId`. The home route `/` SHALL show the same list, or an empty state explaining how to seed data when there are no pages.

#### Scenario: Navigation lists root pages
- **WHEN** the workspace has root pages "Welcome" and "Block showcase"
- **THEN** the navigation shows both, in that order, as links

#### Scenario: Empty workspace
- **WHEN** the workspace has no root pages
- **THEN** the home route shows an empty state that mentions `npm run db:seed`

### Requirement: Error and not-found pages
An unknown route or a page ID that does not exist SHALL render a not-found page inside the shell. An unexpected server error SHALL render an error page, with the error details shown only in development.

#### Scenario: Unknown page ID
- **WHEN** `/pages/does-not-exist` is opened
- **THEN** a not-found page is shown with status 404

