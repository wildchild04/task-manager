## ADDED Requirements

### Requirement: Where a page is mentioned
A page opened at `/pages/:pageId` SHALL list, under its content, the places that mention it inline or reference it with a reference block: each other page (with its title, linking to it) and each task whose description does so (with its title and kind, linking to the task). A place SHALL be listed once, with the number of mentions and references when there is more than one. Mentions and references inside the page itself SHALL NOT be listed, and the section SHALL NOT be shown when nothing points at the page.

#### Scenario: Mentioned by a document and a task
- **WHEN** document "Persistence" mentions "Architecture" twice, and work task "Add login" references it with a reference block
- **THEN** the "Architecture" page lists "Persistence" (2 mentions) and the work task "Add login", each linking to its page

#### Scenario: Nothing points at the page
- **WHEN** no other page or task mentions or references a page
- **THEN** the page shows no "Mentioned in" section
