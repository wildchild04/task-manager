# suggestion-feedback Specification

## Purpose
A human asks an agent for changes to one of its open suggestions, with a short text; the agent finds the suggestion, reads the feedback, and revises the same suggestion in place for review again.
## Requirements
### Requirement: Requesting changes
The human SHALL be able to request changes on a pending suggestion, block or action, including an outdated one, with feedback for its agent: plain text of 1 to 2,000 characters after trimming. Each request SHALL be recorded with the suggestion, its text, when it was made, and the suggestion's revision at that time. Requesting changes SHALL NOT change the page, the subject or the proposal. Requesting changes on a resolved suggestion (approved, rejected or withdrawn) SHALL be refused. Feedback that is empty or too long SHALL be refused. Only humans SHALL request changes. A suggestion with changes requested SHALL still be approvable (unless outdated) and rejectable, and more feedback MAY be added to it.

#### Scenario: Ask for a shorter title
- **WHEN** "claude" suggests renaming the page "Scratch" to "Notes from the Monday planning meeting", and the human requests changes with "Shorter, please: two or three words"
- **THEN** the suggestion reports changes requested with that feedback, and the page is still titled "Scratch"

#### Scenario: Feedback on a resolved suggestion
- **WHEN** the human requests changes on a suggestion that was already rejected
- **THEN** it is refused and no feedback is recorded

#### Scenario: Approve anyway
- **WHEN** the human requested changes on an insert suggestion, then changes their mind and approves it
- **THEN** the proposed blocks are applied and the record is `approved`

### Requirement: Changes requested state
A suggestion SHALL have a revision number, 1 when made and increased by one with each revision. Its feedback is **open** while it was given on the current revision. A pending suggestion with open feedback SHALL be reported as `changes_requested`. This state takes precedence over `outdated`, but approving SHALL still be refused while the suggestion is outdated. Its open feedback SHALL be reported with it, oldest first. Once the suggestion is revised, its earlier feedback SHALL no longer be open, and the suggestion SHALL be reported as `pending` (or `outdated`) again, with the feedback it answered kept on record.

#### Scenario: State after feedback
- **WHEN** the human requests changes on a pending replace suggestion
- **THEN** it is reported as `changes_requested`, revision 1, with the feedback

#### Scenario: State after revision
- **WHEN** its agent revises it
- **THEN** it is reported as `pending`, revision 2, with no open feedback

### Requirement: Revising a suggestion
The agent that made a pending suggestion (pending, outdated or with changes requested) SHALL be able to revise it in place, keeping its ID, action, author, place, and target or subject:
- a block insert or replace SHALL take new proposed blocks, which replace the old ones under the same placement rules as when suggesting; a delete SHALL NOT take blocks;
- a rename SHALL take a new title, and a schedule suggestion a new schedule (or none), checked as when suggesting;
- any suggestion MAY take a new note (at most 280 characters), the agent's reply; an omitted note SHALL keep the old one.

A revision SHALL change at least one of these. Revising SHALL take the target's or subject's current state as the suggestion's new base, so a revised suggestion is no longer outdated. It SHALL increase the revision and record when it was revised. Revising another agent's suggestion SHALL be refused, and so SHALL revising a resolved one. A refused revision SHALL change nothing.

#### Scenario: Revise a rename
- **WHEN** "claude" revises its rename suggestion on "Scratch" with the title "Planning notes" and the note "Shortened as asked"
- **THEN** the suggestion keeps its ID, proposes "Planning notes", shows the note "Shortened as asked", and is `pending` at revision 2

#### Scenario: Revise an insert's blocks
- **WHEN** an agent revises its insert suggestion with two new bullets
- **THEN** the suggestion stays where it was on the page, holding only the two new bullets

#### Scenario: A delete takes no blocks
- **WHEN** an agent revises its delete suggestion with Markdown
- **THEN** it is refused and the suggestion is unchanged

#### Scenario: Revise an outdated replace
- **WHEN** the human edited the target of a replace suggestion, so it's outdated, and its agent revises it with new blocks
- **THEN** it is `pending` again, and approving it replaces the target as it is now

#### Scenario: Someone else's suggestion
- **WHEN** "reviewer" tries to revise a suggestion made by "builder"
- **THEN** it is refused and the suggestion is unchanged

### Requirement: Requesting changes on screen
Wherever a suggestion offers Approve and Reject (the suggestion region on a page or task description, and the action suggestion bars), it SHALL also offer **Request changes**. It SHALL open a dialog titled "Request changes" with a multi-line field labelled "What should change?", a **Send** button (disabled while the field is empty) and **Cancel**. Sending SHALL record the feedback, close the dialog and show the suggestion with the status "Changes requested" and the feedback as "You asked: <feedback>", with the latest of several shown. A refusal SHALL be shown in the dialog. A suggestion revised since feedback SHALL show the status "Revised" and the feedback it answered as "You asked: <feedback>", until the next feedback or decision. Approve SHALL still be shown unless the suggestion is outdated.

#### Scenario: Request changes on a page
- **WHEN** the human chooses Request changes on an insert suggestion, writes "Use a numbered list" and sends it
- **THEN** the dialog closes, and the suggestion shows "Changes requested", "You asked: Use a numbered list", and Reject, Request changes and Approve

#### Scenario: Revised suggestion
- **WHEN** the agent then revises it with a numbered list
- **THEN** the suggestion shows "Revised", "You asked: Use a numbered list", and the numbered list under "Proposed"

#### Scenario: On an action bar
- **WHEN** the human requests changes on "claude suggests renaming this page to "Notes from the Monday planning meeting""
- **THEN** the bar shows "Changes requested" and the feedback, with Approve, Reject and Request changes

