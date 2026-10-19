## ADDED Requirements

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
