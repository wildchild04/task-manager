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
Every page SHALL render inside an app shell. Its navigation SHALL start with a "Home" item linking to the home route (marked when it is open), and SHALL list the projects, oldest first, each linking to `/projects/:projectId`, under a "Projects" heading that links to the home route and offers creating a project (which then opens it). While a project (or one of its tasks or documents) is open, the navigation SHALL also list that project's sections: Home, Explorations, Updates, Work, Chores and Knowledge library, with the current one marked, followed by the project's knowledge library as a tree of documents linking to `/pages/:pageId`, with the open document marked and its ancestors expanded. The workspace's pages SHALL be listed in a separate "Pages" group, always shown (saying when there are none) and offering creating a top-level page (titled, added after the others, then opened), as a tree: the top-level pages in order, each with the pages nested in it at any depth, each linking to `/pages/:pageId`, with the open page marked and its ancestors expanded. The home route `/` SHALL list the projects (see the project-screens capability), or an empty state explaining how to create a project or seed sample data when there are none.

#### Scenario: Navigation lists projects
- **WHEN** projects "Taskhub" and "Garden" exist
- **THEN** the navigation shows both, in that order, as links

#### Scenario: Project sections
- **WHEN** a chores list of project "Taskhub" is open
- **THEN** the navigation shows Taskhub's sections with "Chores" marked as current

#### Scenario: Library tree in the navigation
- **WHEN** document "Auth design", nested in "Architecture" in project "Taskhub", is open
- **THEN** the navigation shows Taskhub's library tree with "Architecture" expanded and "Auth design" marked as current

#### Scenario: Navigation lists root pages
- **WHEN** the workspace has root pages "Welcome" and "Block showcase"
- **THEN** the navigation's "Pages" group shows both, in that order, as links

#### Scenario: Nested workspace page
- **WHEN** page "A sub-page", nested in workspace page "Block showcase", is open
- **THEN** the "Pages" group shows "Block showcase" expanded with "A sub-page" under it, marked as current

#### Scenario: Empty workspace
- **WHEN** there are no projects
- **THEN** the home route shows an empty state that offers creating a project and mentions `npm run db:seed`

#### Scenario: Create a page from the navigation
- **WHEN** "Meeting notes" is created from the "Pages" group while a project's work list is open
- **THEN** the browser is on the new page, and the "Pages" group lists it after the other top-level pages

#### Scenario: Create a project from the navigation
- **WHEN** "Garden" is created from the "Projects" heading while another project is open
- **THEN** the browser is on Garden's home, and the navigation lists it

### Requirement: Error and not-found pages
An unknown route or a page ID that does not exist SHALL render a not-found page inside the shell. An unexpected server error SHALL render an error page, with the error details shown only in development.

#### Scenario: Unknown page ID
- **WHEN** `/pages/does-not-exist` is opened
- **THEN** a not-found page is shown with status 404

### Requirement: Notification bell
The app shell's top bar SHALL show a bell button on every screen, with a badge counting the places that need the human (hidden at zero): pages and tasks with pending suggestions, chores that are overdue or urgent, and work tasks returned by an agent and not yet started again. Its accessible name SHALL include the count. Opening it SHALL list those places, one row each: suggestions waiting (oldest first, with the number of suggestions and the agents that made them), then overdue chores, urgent chores by due time, and returned work (with the agent that returned it); choosing a row SHALL open the page or task. With nothing to show, the list SHALL say "Nothing needs you". The count and list SHALL be the same as the home dashboard's for the same items, and SHALL be current after every navigation and every action taken in the app.

#### Scenario: Suggestions waiting
- **WHEN** "claude" has two pending suggestions on the exploration "Block editor v1"
- **THEN** the bell's badge shows 1, and its list has the row "Block editor v1" with "2 suggestions · claude", which opens the exploration

#### Scenario: Several kinds
- **WHEN** a page has a pending suggestion, chore "Water plants" is overdue, and "builder" returned work "Fix oven"
- **THEN** the badge shows 3, and the list shows the page, then "Water plants" (Overdue), then "Fix oven" (Returned by builder)

#### Scenario: Count follows a decision
- **WHEN** the only pending suggestion is approved on its page
- **THEN** the bell has no badge and its list says "Nothing needs you"

#### Scenario: Work in progress isn't listed
- **WHEN** the only active work is in progress with an agent
- **THEN** the bell has no badge

