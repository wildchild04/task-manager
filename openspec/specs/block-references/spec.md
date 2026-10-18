# block-references Specification

## Purpose
TBD - created by archiving change block-data-model. Update Purpose after archive.
## Requirements
### Requirement: Reference blocks
A `reference` block SHALL point at another block by its ID (`props.targetId`) without owning it. The target MAY be any block, including a page or a block on another page. The target's ownership and position SHALL NOT change because it is referenced. Several references MAY point at the same target.

#### Scenario: Reference a block on another page
- **WHEN** a `reference` block is inserted on page P with `targetId` set to block X on page Q
- **THEN** X still belongs to page Q, and P's children include the reference

#### Scenario: Target must exist when the reference is created
- **WHEN** a `reference` is inserted with a `targetId` that does not exist (and is not inserted earlier in the same batch)
- **THEN** the operation is rejected with a not-found error

#### Scenario: Reference cannot point at itself
- **WHEN** a `reference` is inserted with `targetId` equal to its own ID
- **THEN** the operation is rejected

### Requirement: Missing targets
Deleting a block SHALL NOT delete references that point at it, nor references that point at any block in its deleted subtree. Such references remain in place and resolve as missing.

#### Scenario: Target is deleted
- **WHEN** block X is deleted while a reference R points at it
- **THEN** R still exists and resolving R returns `missing`

### Requirement: Resolving references
The system SHALL resolve a reference given an expansion path: the list of block IDs already being expanded above it (its ancestors and the targets of any enclosing references). Resolution SHALL return one of:
- `ok` with the target block
- `missing` when the target does not exist
- `cycle` when the target is on the expansion path, or is the reference itself or one of the reference's ancestors

#### Scenario: Normal resolution
- **WHEN** reference R on page P points at block X on page Q, and the expansion path is `[P]`
- **THEN** resolution returns `ok` with X

#### Scenario: Reference to its own page
- **WHEN** reference R on page P points at P
- **THEN** resolution returns `cycle`

#### Scenario: Indirect cycle through two references
- **WHEN** page P contains R1 pointing at page Q, Q contains R2 pointing at page P, and R2 is resolved with expansion path `[P, Q]`
- **THEN** resolving R2 returns `cycle`

### Requirement: Incoming references
The system SHALL list all reference blocks whose target is a given block ID, including references whose target no longer exists.

#### Scenario: List backlinks
- **WHEN** references R1 and R2 point at block X
- **THEN** listing incoming references for X returns R1 and R2

### Requirement: Incoming mentions
The system SHALL list all blocks whose content mentions a given page ID, each once however many times it mentions the page, including when the page no longer exists.

#### Scenario: List mentioning blocks
- **WHEN** paragraphs M1 and M2 mention page X, and M1 mentions it twice
- **THEN** listing the blocks mentioning X returns M1 and M2, each once

#### Scenario: Mentions of other pages are not listed
- **WHEN** paragraph M mentions page Y but not X
- **THEN** listing the blocks mentioning X does not return M

