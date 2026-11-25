## ADDED Requirements

### Requirement: Recorded task events
Besides its transitions, step changes and incorrect marks, which keep their own records, every change to a task SHALL be recorded with who made it (the human or an agent's name) and when: created (also by a transition: promoted work, a chore's next occurrence); renamed (with the new title); description edited; a comment added, edited or deleted; a diagnostic entry added, edited, relabelled or deleted; a reference added or removed; urgency set; schedule changed or removed; a step added or removed (with its title); a suggestion on the task's description made, approved, rejected, withdrawn or reopened; and a suggested transition made, applied, dismissed, withdrawn or outdated (with the transition). Repeated edits of the same description, comment or entry by the same actor within 10 minutes SHALL be one event, at the latest edit's time, since the editor saves as it is typed. An event SHALL be recorded in the same step as its change, so a refused change records nothing. Deleting the task SHALL remove its events.

#### Scenario: Typing is one edit
- **WHEN** the human edits a task's description three times within five minutes
- **THEN** its history has one "Edited the description" by "You", at the last edit's time

#### Scenario: An applied suggestion
- **WHEN** "planner" suggests completing a chore and the human completes it
- **THEN** its history shows, newest first, the Complete transition, "Applied the suggested Complete" and "Suggested: Complete" by "planner"

#### Scenario: Created by promotion
- **WHEN** an agent's exploration is promoted by the human
- **THEN** the new work's history starts with "Created by promotion" by "You"

### Requirement: Agents read the history
`GET task/:id/history` and the `list_history` tool SHALL return the task's whole history (transitions, step changes, marks and events) newest first, at most `limit` (default 10) entries with `cursor` for older ones, each as `{ id, type, label, from?, to?, actor?, note?, at }`: `type` is `transition`, `step`, `flag` or `event`, `actor` is `human` or the agent's name (absent when unknown), and `at` is an ISO time.

#### Scenario: Paging the history
- **WHEN** an agent starts a work task, comments "On it" and reads its history with `limit: 2`
- **THEN** it gets "Commented" with the note "On it" and the Start transition, with `more: true`, and the next page has "Created"
