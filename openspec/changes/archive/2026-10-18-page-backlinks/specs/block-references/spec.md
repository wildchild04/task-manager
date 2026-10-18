## ADDED Requirements

### Requirement: Incoming mentions
The system SHALL list all blocks whose content mentions a given page ID, each once however many times it mentions the page, including when the page no longer exists.

#### Scenario: List mentioning blocks
- **WHEN** paragraphs M1 and M2 mention page X, and M1 mentions it twice
- **THEN** listing the blocks mentioning X returns M1 and M2, each once

#### Scenario: Mentions of other pages are not listed
- **WHEN** paragraph M mentions page Y but not X
- **THEN** listing the blocks mentioning X does not return M
