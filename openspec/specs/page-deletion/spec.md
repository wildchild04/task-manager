# page-deletion Specification

## Purpose
TBD - created by archiving change block-editor-v0. Update Purpose after archive.
## Requirements
### Requirement: Which pages can be deleted
Library documents and workspace pages, at any depth, SHALL be deletable, together with every page and block inside them. A project's home page and knowledge library root, and task body pages, SHALL not be deletable. References to a deleted page or block SHALL show as missing.

#### Scenario: Delete a document with pages inside
- **WHEN** "Architecture", which contains "Persistence" and "Unit of work", is deleted
- **THEN** none of the three pages exist, and the library tree no longer shows them

#### Scenario: Reference to a deleted page
- **WHEN** a task references a block of a document that is then deleted
- **THEN** the task's reference shows as missing

### Requirement: Deleting from the page
A deletable page SHALL show a delete button at the top right. It SHALL open a confirmation dialog naming the page and saying how many pages inside it will be deleted too; only confirming SHALL delete. After deleting, the browser SHALL go to the deleted page's parent page if it has one, otherwise to the project's knowledge library for a library document, otherwise to the home route. Pages that aren't deletable SHALL show no delete button.

#### Scenario: Confirm deletion
- **WHEN** the delete button of "Architecture" (with two pages inside) is pressed
- **THEN** a dialog asks to confirm deleting "Architecture" and the 2 pages inside it, and nothing is deleted until it is confirmed

#### Scenario: Back to the library
- **WHEN** a top-level library document is deleted
- **THEN** the browser is on the project's knowledge library page, which no longer lists it

### Requirement: Deleting from the navigation
Each library document in the navigation's library tree, and each page in the "Pages" group, SHALL offer a delete action that opens the same confirmation dialog. Deleting the page that is open SHALL navigate as deleting from the page does; deleting another page SHALL keep the current page open.

#### Scenario: Delete another document from the sidebar
- **WHEN** document "Conventions" is deleted from the navigation while "Persistence" is open
- **THEN** "Conventions" is gone from the tree and "Persistence" stays open

