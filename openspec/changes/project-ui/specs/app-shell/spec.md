## MODIFIED Requirements

### Requirement: App shell and navigation
Every page SHALL render inside an app shell. Its navigation SHALL list the projects, oldest first, each linking to `/projects/:projectId`. While a project (or one of its tasks or documents) is open, the navigation SHALL also list that project's sections: Home, Explorations, Updates, Work, Chores and Knowledge library, with the current one marked, followed by the project's knowledge library as a tree of documents linking to `/pages/:pageId`, with the open document marked and its ancestors expanded. The workspace's root pages SHALL be listed in a separate "Pages" group, in order, each linking to `/pages/:pageId`. The home route `/` SHALL list the projects (see the project-screens capability), or an empty state explaining how to create a project or seed sample data when there are none.

#### Scenario: Navigation lists projects
- **WHEN** projects "Taskhub" and "Garden" exist
- **THEN** the navigation shows both, in that order, as links

#### Scenario: Project sections
- **WHEN** a chores list of project "Taskhub" is open
- **THEN** the navigation shows Taskhub's sections with "Chores" marked as current

#### Scenario: Library tree in the navigation
- **WHEN** document "Auth design", nested in "Architecture" in project "Taskhub", is open
- **THEN** the navigation shows Taskhub's library tree with "Architecture" expanded and "Auth design" marked as current

#### Scenario: Workspace pages
- **WHEN** the workspace has root pages "Welcome" and "Block showcase"
- **THEN** the navigation's "Pages" group shows both, in that order, as links

#### Scenario: Empty workspace
- **WHEN** there are no projects
- **THEN** the home route shows an empty state that offers creating a project and mentions `npm run db:seed`
