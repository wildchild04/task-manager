## 1. Matching

- [x] 1.1 `app/lib/list-search.ts`: text matching, property filter queries (and/or, the six operators used), `?f=` / `?join=` encoding, PropertyFilter i18n strings
- [x] 1.2 Unit tests for matching and encoding

## 2. Task list pages

- [x] 2.1 PropertyFilter with each list's properties and value suggestions; filter in the URL, kept by the state filter; match count; empty state with "Clear filter"
- [x] 2.2 Remove the quick-add row; spec and e2e updates

## 3. Project home and home page

- [x] 3.1 Search box on each project home task tab (`?q=`, items and completed items)
- [x] 3.2 Search boxes on Needs attention (all items, then at most 10), Waiting for review and Recently edited; `attention` becomes `{ items, limit }`

## 4. Tests

- [x] 4.1 Home and on-call shell tests for the attention shape
- [x] 4.2 e2e: tickets by severity with reload, work list search by sub-project, project tab search, Needs attention search
