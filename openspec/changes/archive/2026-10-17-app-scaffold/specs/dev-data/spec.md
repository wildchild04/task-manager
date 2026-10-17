## ADDED Requirements

### Requirement: Seed sample data
`npm run db:seed` SHALL create sample workspace pages in the local database through the block service: a "Welcome" page, and a "Block showcase" page containing every block type, nested content, rich-text marks, a sub-page, and references (to a page, to a block, missing, and circular). Seeding SHALL be idempotent: running it again SHALL NOT duplicate pages.

#### Scenario: Seed an empty database
- **WHEN** `npm run db:seed` is run on an empty database
- **THEN** the workspace has the sample pages and the showcase contains every block type

#### Scenario: Seed twice
- **WHEN** `npm run db:seed` is run a second time
- **THEN** the workspace still has exactly one copy of each sample page

### Requirement: Reset local data
`npm run db:reset` SHALL delete the local database file and its WAL files, so the next start creates a fresh, migrated database.

#### Scenario: Reset
- **WHEN** `npm run db:reset` is run and then `npm run dev`
- **THEN** the workspace has no pages
