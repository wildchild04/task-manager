## MODIFIED Requirements

### Requirement: Owned pages are not browsable
The viewer SHALL open workspace pages, a project's home page, the project's knowledge library documents, and pages nested under any of them. Other owned roots (task body pages and comment bodies) and their content SHALL NOT be opened through `/pages/:pageId`; a task's body is shown on its task overview. A library document's page SHALL link back to its project.

#### Scenario: Owned root
- **WHEN** `/pages/:pageId` is opened with the ID of a task's body page
- **THEN** a not-found page is shown

#### Scenario: Library document
- **WHEN** `/pages/:pageId` is opened with the ID of a document in project P's library
- **THEN** the document is shown with a link back to project P
