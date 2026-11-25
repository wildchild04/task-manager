## MODIFIED Requirements

### Requirement: Starting explorations and updates from anything
Every task page in a mode that has explorations SHALL offer "Start exploration", except an exploration's own page, and every comment SHALL offer "Start exploration from this comment": each asks for a title and creates an open exploration in the same project referencing the task or comment, then opens it. Starting an exploration from an exploration SHALL be refused. A done work task SHALL also offer "Start update", which asks for a title and creates an open update iterating on it, then opens it. An empty title SHALL be rejected.

#### Scenario: Exploration from a cancelled work task
- **WHEN** "Start exploration" with the title "Rethink sync" is applied on a cancelled work task
- **THEN** the browser is on the new exploration "Rethink sync", whose references list the cancelled work task

#### Scenario: Exploration from a comment
- **WHEN** "Start exploration from this comment" is applied on a comment
- **THEN** the new exploration references that comment, linking back to it on its task page

#### Scenario: Update from done work
- **WHEN** "Start update" with the title "Faster login" is applied on a done work task
- **THEN** the browser is on the new update "Faster login", whose lineage shows it iterating on that work

#### Scenario: Not on an exploration
- **WHEN** an open or tombstoned exploration's page is shown
- **THEN** it offers no "Start exploration", and posting the action anyway is refused
