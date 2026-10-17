## MODIFIED Requirements

### Requirement: Owned pages are not browsable
The viewer SHALL open workspace pages, a project's home page, the project's knowledge library documents, and pages nested under any of them. Other owned roots (task body pages and comment bodies) and their content SHALL NOT be opened through `/pages/:pageId`; a task's body is shown on its task overview. A page SHALL show a breadcrumb of where it is, each ancestor linked: for a library document, the project, "Knowledge library", then the documents containing it; for a page under the project's home page, the project then the pages containing it; for a nested workspace page, the pages containing it. A top-level workspace page SHALL show no breadcrumb.

#### Scenario: Owned root
- **WHEN** `/pages/:pageId` is opened with the ID of a task's body page
- **THEN** a not-found page is shown

#### Scenario: Library document
- **WHEN** `/pages/:pageId` is opened with the ID of a document "Persistence" inside "Architecture" in project P's library
- **THEN** the document is shown with the breadcrumb P › Knowledge library › Architecture › Persistence, where P links to the project home, "Knowledge library" to the library page and "Architecture" to its page
