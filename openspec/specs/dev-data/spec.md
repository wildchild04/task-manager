# dev-data Specification

## Purpose
TBD - created by archiving change app-scaffold. Update Purpose after archive.
## Requirements
### Requirement: Seed sample data
`npm run db:seed` SHALL create sample data in the local database through the domain services:
- workspace pages: a "Welcome" page, and a "Block showcase" page containing every block type, nested content, rich-text marks, a sub-page, and references (to a page, to a block, missing, and circular)
- a sample project with: home page content; nested knowledge library documents; open and tombstoned explorations; an exploration promoted to work; work in each state, including returned work; an update iterating on done work; chores that are scheduled and recurring, overdue, marked urgent, and unscheduled; and a comment on a work task

Seeding SHALL be idempotent per part: the workspace pages and the sample project are each created only if they don't exist yet, so running it again SHALL NOT duplicate anything, and running it on a database seeded before the sample project existed SHALL add only the project.

#### Scenario: Seed an empty database
- **WHEN** `npm run db:seed` is run on an empty database
- **THEN** the workspace has the sample pages and the sample project, the showcase contains every block type, and the project has tasks of every kind

#### Scenario: Seed twice
- **WHEN** `npm run db:seed` is run a second time
- **THEN** there is still exactly one copy of each sample page and of the sample project

#### Scenario: Seed an older database
- **WHEN** `npm run db:seed` is run on a database that already has the sample pages but no sample project
- **THEN** the sample project is added and the pages are unchanged

### Requirement: Reset local data
`npm run db:reset` SHALL delete the local database file and its WAL files, so the next start creates a fresh, migrated database.

#### Scenario: Reset
- **WHEN** `npm run db:reset` is run and then `npm run dev`
- **THEN** the workspace has no pages

