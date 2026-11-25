## REMOVED Requirements

### Requirement: Which tasks allow comments
**Reason**: Every kind takes comments now.
**Migration**: See "Every task allows comments".

## ADDED Requirements

### Requirement: Every task allows comments
Comments SHALL be allowed on every task, of any kind and in any state.

#### Scenario: Comment on a ticket
- **WHEN** a comment is added to a ticket
- **THEN** it is created

#### Scenario: Comment on an experiment
- **WHEN** a comment is added to an experiment
- **THEN** it is created

#### Scenario: Comment on a chore
- **WHEN** a comment is added to a chore
- **THEN** it is created

#### Scenario: Comment on done work
- **WHEN** a comment is added to a work task in state `done`
- **THEN** it is created

#### Scenario: Comment on an exploration
- **WHEN** a comment is added to an exploration
- **THEN** it is created
