## MODIFIED Requirements

### Requirement: Approve all and reject all
A page with more than one pending suggestion SHALL offer **Approve all** and **Reject all**, applying to that page's pending suggestions in document order as one step. Approve all SHALL skip outdated suggestions and suggestions with changes requested (see suggestion-feedback), and report how many were approved and how many of each were skipped. Reject all SHALL reject suggestions with changes requested too.

#### Scenario: Approve all with one outdated
- **WHEN** a page has three pending suggestions, one of them outdated, and Approve all is chosen
- **THEN** two are approved, the outdated one stays pending, and the page reports "2 approved, 1 outdated"

#### Scenario: Approve all with changes requested
- **WHEN** a page has three pending suggestions, the human requested changes on one, and Approve all is chosen
- **THEN** two are approved, the one with changes requested stays as it was, and the page reports "2 approved, 1 waiting for changes"
