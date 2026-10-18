## 1. Store

- [x] 1.1 `listMentioning(pageId)` on the block repository port and service; SQLite (`json_each`) and memory implementations
- [x] 1.2 Contract tests: lists each mentioning block once, ignores mentions of other pages, keeps working after the page is deleted

## 2. Page view

- [x] 2.1 `pageBacklinks`: mentions and references grouped by place (pages and tasks), counts, self excluded, comments skipped; tests
- [x] 2.2 Page loader and the "Mentioned in" section; hidden when empty
- [x] 2.3 Headless check of both scenarios; typecheck and full test run
