## ADDED Requirements

### Requirement: Suggestions waiting for review
The home dashboard SHALL show a "Waiting for review" section listing each page and task with pending suggestions: its title and place, linking to it, the number of pending suggestions, and the agents that made them, the place with the oldest pending suggestion first. The section SHALL NOT be shown when no suggestion is pending.

#### Scenario: Two places waiting
- **WHEN** "builder" has two pending suggestions on the exploration "Block editor v1" and "planner" one on the page "Roadmap", made later
- **THEN** the home dashboard lists "Block editor v1" (2, builder) first and "Roadmap" (1, planner) second, each linking to it

#### Scenario: Nothing pending
- **WHEN** every suggestion has been approved or rejected
- **THEN** the home dashboard shows no "Waiting for review" section
