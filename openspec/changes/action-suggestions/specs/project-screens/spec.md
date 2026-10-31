## MODIFIED Requirements

### Requirement: Suggestions waiting for review
The home dashboard SHALL show a "Waiting for review" section listing each project, page and task with pending suggestions, block or action suggestions alike: its title and place, linking to it (a project to its project home), the number of pending suggestions, and the agents that made them, or, when its only pending suggestion is an action, the action in words; the place with the oldest pending suggestion first. Action suggestions whose subject no longer exists SHALL NOT be listed. The section SHALL NOT be shown when no suggestion is pending.

#### Scenario: Two places waiting
- **WHEN** "builder" has two pending suggestions on the exploration "Block editor v1" and "planner" one on the page "Roadmap", made later
- **THEN** the home dashboard lists "Block editor v1" (2, builder) first and "Roadmap" (1, planner) second, each linking to it

#### Scenario: An action waiting
- **WHEN** "builder"'s only pending suggestion is to cancel the work "Old migration"
- **THEN** the home dashboard lists "Old migration" with "Suggests cancelling this work · builder", linking to the task

#### Scenario: Nothing pending
- **WHEN** every suggestion has been approved or rejected
- **THEN** the home dashboard shows no "Waiting for review" section
