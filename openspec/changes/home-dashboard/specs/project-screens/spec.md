## MODIFIED Requirements

### Requirement: Projects home
The home route `/` SHALL be a dashboard of projects and pages:

- a header offering creating a page and creating a project (each opens what it created);
- **Needs attention**, across all projects: chores in to do that are urgent or overdue, work tasks in to do whose last transition was a return by an agent (naming the agent), and work in progress (naming the agent holding it, if any); ordered urgent chores first (overdue before urgent, then by due time), then returned work, then work in progress (most recently updated first); at most 10 items with how many more there are; each item linking to its task and showing its project;
- **Projects**: every project, oldest first, each linking to its project home and showing its number of active work tasks (to do and in progress), open ideas (open explorations and updates) and urgent chores;
- **Pages**: the workspace's pages as a tree, or an empty state offering a new page;
- **Recently edited**: the 8 library documents, workspace pages and tasks whose title or content changed most recently, each with its place and when, linking to it.

Creating a project from the home route SHALL work as from the navigation; after creation the browser SHALL go to the new project's home. An empty title SHALL be rejected with a message, keeping the dialog open. When there are no projects, the projects section SHALL offer creating one and mention `npm run db:seed`.

#### Scenario: Create a project
- **WHEN** a project titled "Taskhub" is created from the home route
- **THEN** the browser is on `/projects/<id>` for the new project, and the navigation lists it

#### Scenario: Empty title
- **WHEN** a project is created with an empty title
- **THEN** no project is created and the dialog shows that a title is required

#### Scenario: Needs attention
- **WHEN** project A has an overdue chore and project B has a work task the agent "builder" returned and another in progress held by "builder"
- **THEN** "Needs attention" lists the overdue chore first, then the returned task ("Returned by builder"), then the task in progress ("builder"), each with its project

#### Scenario: Project counts
- **WHEN** a project has two work tasks in to do, one in progress, one done, one open exploration and one urgent chore
- **THEN** its card shows 3 active work, 1 open idea and 1 urgent chore

#### Scenario: Recently edited
- **WHEN** a library document is edited after a task's description was edited
- **THEN** "Recently edited" lists the document before the task
