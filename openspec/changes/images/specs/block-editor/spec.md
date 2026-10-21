## ADDED Requirements

### Requirement: Adding images
Images SHALL be added to a page by the slash menu's Image command (which removes the `/image` text and opens the file picker, offering the camera on phones), by pasting image files (a screenshot or a copied image, whose clipboard text and HTML are then ignored), and by dropping image files on the page. Each chosen image SHALL be uploaded (see the content-storage capability) and, once uploaded, inserted as an image block: after the caret's block for the picker and paste (in place of it when it's an empty paragraph), and after the block under the pointer for a drop (before the first block when dropped above it). Several images SHALL be inserted in order, as one undo step, with the caret then in the text block after them (an empty paragraph added when there's none). While uploads run the page SHALL say "Uploading image…" ("Uploading 2 images…"); a refused or failed file SHALL be named with the reason, and the others SHALL still be added. Cancelling the file picker SHALL change nothing more. Dropping files that aren't images SHALL do nothing.

#### Scenario: Image from the slash menu
- **WHEN** "/image" is typed in an empty paragraph, Enter is pressed and a PNG is chosen
- **THEN** after the upload the paragraph is replaced by an image block showing it, followed by an empty paragraph holding the caret

#### Scenario: Paste a screenshot
- **WHEN** a screenshot is pasted with the caret in the paragraph "See below"
- **THEN** after the upload an image block follows that paragraph, and one Cmd/Ctrl+Z removes it

#### Scenario: Drop two photos
- **WHEN** two JPEGs are dropped below the second paragraph
- **THEN** two image blocks follow the second paragraph in the order they were dropped

#### Scenario: A file that's too big
- **WHEN** a 20 MB photo and a small PNG are pasted together
- **THEN** the page says the photo is too big (images can be at most 10 MB) and the PNG is added

### Requirement: Image blocks in the editor
An image block SHALL show its image at most the page's width. It SHALL never hold the caret: arrow keys SHALL step over it, and Backspace at the start of the block after it SHALL move the caret to the end of the text block before it without deleting it. It SHALL be selected, moved, duplicated, copied and deleted like any block (see "Block selection" and "Acting on selected blocks"); a duplicate SHALL show the same stored image. Its handle menu SHALL offer "Alt text…", which edits the image's alt text as one undo step.

#### Scenario: Backspace after an image
- **WHEN** Backspace is pressed at the start of a paragraph that follows an image
- **THEN** the image stays and the caret is at the end of the text block before it

#### Scenario: Alt text
- **WHEN** "Alt text…" is chosen from an image's handle menu and "Server rack, front view" is entered
- **THEN** the image's alt text is "Server rack, front view", and Cmd/Ctrl+Z restores the previous one
