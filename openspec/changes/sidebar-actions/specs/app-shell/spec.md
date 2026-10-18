## MODIFIED Requirements

### Requirement: App shell and navigation
Every page SHALL render inside an app shell. Its navigation SHALL list the projects, oldest first, each linking to `/projects/:projectId`, under a "Projects" heading that links to the home route and offers creating a project (which then opens it). While a project (or one of its tasks or documents) is open, the navigation SHALL also list that project's sections: Home, Explorations, Updates, Work, Chores and Knowledge library, with the current one marked, followed by the project's knowledge library as a tree of documents linking to `/pages/:pageId`, with the open document marked and its ancestors expanded. The workspace's pages SHALL be listed in a separate "Pages" group, always shown (saying when there are none) and offering creating a top-level page (titled, added after the others, then opened), as a tree: the top-level pages in order, each with the pages nested in it at any depth, each linking to `/pages/:pageId`, with the open page marked and its ancestors expanded. The home route `/` SHALL list the projects (see the project-screens capability), or an empty state explaining how to create a project or seed sample data when there are none.

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
