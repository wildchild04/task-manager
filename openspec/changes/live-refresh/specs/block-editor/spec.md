## MODIFIED Requirements

### Requirement: Saving edits
Every edit SHALL show at once and be saved in the background as a batch of block operations: typing after it pauses briefly, and any structural edit at once, preserving the order of edits. The page SHALL show whether edits are being saved, are saved, or couldn't be saved. A failed save SHALL keep the edits on the page and retry; a save the server rejects SHALL show the reason and reload the page's content from the server. Following a link with unsaved edits SHALL save them first and leave once they are saved; while they aren't, it SHALL ask whether to leave and lose them. Closing the browser tab with unsaved edits SHALL ask for confirmation. A change made elsewhere to the page while it is open (in another tab, or by an agent; see the live-refresh capability) SHALL appear in the editor without navigating once it has no unsaved edits; unsaved edits SHALL never be replaced. When the content is replaced, the caret SHALL stay in its block (at most at the block's new end) when the block still exists, and the undo history SHALL start afresh.

#### Scenario: Fast typing then Enter
- **WHEN** text is typed and Enter pressed several times quickly, then the page is reloaded once saved
- **THEN** the reloaded page has exactly the same blocks and text

#### Scenario: Leaving with unsaved edits
- **WHEN** a link is followed while an edit hasn't been saved, and the server can't be reached
- **THEN** the page asks whether to leave and lose the edit, and stays if asked to

#### Scenario: An agent appends to the open description
- **WHEN** a task's description is open with the caret in its second paragraph and nothing unsaved, and an agent appends a paragraph to it
- **THEN** the new paragraph appears at the end and the caret is still in the second paragraph

#### Scenario: Unsaved edits are kept
- **WHEN** a change made elsewhere arrives while an edit on the page hasn't been saved yet
- **THEN** the edit stays on the page and is saved, and the other change appears once nothing is unsaved
