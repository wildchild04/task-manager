## ADDED Requirements

### Requirement: Global search
The top bar SHALL have a search box. As the user types, it SHALL list the workspace pages, library documents, tasks and project homes whose title contains the text (ignoring case), or whose ID starts with it (a page's, task's or project's ID, or a ticket's ticket ID; from 4 characters, ignoring case). Each result SHALL show its title and where it lives, and a result found by ID SHALL show the matched ID. ID matches SHALL come first (an exact ID before a prefix), then title matches, earliest match first, then by title, at most 20. When nothing matches it SHALL say "No matches". Choosing a result SHALL open it and clear the box. Matches SHALL be served by `GET /api/search?q=` as `{ results: [{ id, title, place, href, matchedId? }] }`; an empty query finds nothing.

#### Scenario: Search by title
- **WHEN** "searchable alarm" is typed and ticket "Searchable alarm" exists
- **THEN** the search lists it with its place, and choosing it opens the ticket and clears the box

#### Scenario: Search by ID prefix
- **WHEN** the first 8 characters of a task's ID are typed
- **THEN** the search lists the task with its full ID shown

#### Scenario: Search by ticket ID
- **WHEN** "v200" is typed and a ticket has ticket ID "V2001234"
- **THEN** the search lists the ticket with "V2001234" shown

#### Scenario: Short or inner ID text
- **WHEN** fewer than 4 characters of an ID, or characters from the middle of an ID, are typed
- **THEN** the search doesn't list it unless its title matches

#### Scenario: Nothing matches
- **WHEN** text that matches no title or ID is typed
- **THEN** the search says "No matches"
