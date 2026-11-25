## 1. Search

- [x] 1.1 `globalSearch` in `app/lib/page-search.server.ts`: titles anywhere, page/task/project IDs and ticket IDs by prefix (from 4 characters), ID matches first, at most 20
- [x] 1.2 `GET /api/search?q=`
- [x] 1.3 Unit tests

## 2. Top bar

- [x] 2.1 `GlobalSearch` Autosuggest in TopNavigation's `search` slot: debounced fetch, place and matched ID per result, "No matches", opens the chosen result and clears the box
- [x] 2.2 e2e: by title, by short ID, by ticket ID, no match
