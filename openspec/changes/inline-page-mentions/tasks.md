## 1. Model

- [ ] 1.1 Mention spans in the rich-text schema and types; validation of targets and no mentions in titles; `plainText` skips mentions
- [ ] 1.2 Contract tests for SQLite and memory: round-trip, missing target rejected, title rejected, mention of a page deleted later reads back unchanged

## 2. Rendering

- [ ] 2.1 Resolve mentions in page views and editable pages (`mentions` map); render them read-only as links or missing markers
- [ ] 2.2 Editor rendering of mentions as non-editable inline elements; caret mapping and snapping around them; click navigates in the app

## 3. Editing

- [ ] 3.1 `normalize`/`slice` keep mention spans whole; `insertMention` command; paste strips U+FFFC; tests including undo
- [ ] 3.2 Reuse `GET /api/pages?q=` (added by `block-editor-v0` for page links) for the `@` menu
- [ ] 3.3 Generalize the slash menu into an inline menu with command and page sources; the `@` menu with debounced search, paging, empty state
- [ ] 3.4 Headless check: insert, arrows over, Backspace/Delete, split/merge around a mention, rename and delete of the mentioned page; typecheck and full test run
