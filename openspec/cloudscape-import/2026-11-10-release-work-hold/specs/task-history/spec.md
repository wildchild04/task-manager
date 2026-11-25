## MODIFIED Requirements

### Requirement: Recorded task events

Besides its transitions, step changes and incorrect marks, which keep their own records, every change to a task SHALL be recorded with who made it (the human or an agent's name) and when: created (also by a transition: promoted work, a chore's next occurrence); renamed (with the new title); description edited; a comment added, edited or deleted; a diagnostic entry added, edited, relabelled or deleted; a reference added or removed; urgency set; schedule changed or removed; a suggestion on the task's description made, approved, rejected, withdrawn or reopened; a suggested transition made, applied, dismissed, withdrawn or outdated (with the transition); a ticket moved (with the root cause it moved to, or out of its root cause to the shift); a ticket's finding set (with its text) or cleared; and a work task's hold released by the human (with the agent that held it) or taken over by an agent. Steps are no longer added or removed by hand, so no new "step added" or "step removed" events are made; those recorded before (on experiments, with the step's title) SHALL still show in the task's history. Repeated edits of the same description, comment or entry by the same actor within 10 minutes SHALL be one event, at the latest edit's time, since the editor saves as it is typed. An event SHALL be recorded in the same step as its change, so a refused change records nothing. Deleting the task SHALL remove its events.

#### Scenario: Typing is one edit

- **WHEN** the human edits a task's description three times within five minutes
- **THEN** its history has one "Edited the description" by "You", at the last edit's time

#### Scenario: An applied suggestion

- **WHEN** "planner" suggests completing a chore and the human completes it
- **THEN** its history shows, newest first, the Complete transition, "Applied the suggested Complete" and "Suggested: Complete" by "planner"

#### Scenario: Created by promotion

- **WHEN** an agent's exploration is promoted by the human
- **THEN** the new work's history starts with "Created by promotion" by "You"

#### Scenario: Older step events

- **WHEN** an experiment whose history recorded "Added step "Benchmark"" by "planner" is opened
- **THEN** its history still shows that event

#### Scenario: A released hold

- **WHEN** the human releases "builder"'s hold on a work task and "reviewer" takes it over
- **THEN** its history shows, newest first, "Took over the task" by "reviewer" and "Released the hold of builder" by "You"
