## 0. Before starting

- [x] 0.1 Archive `agent-create-tasks`, `agent-create-pages` and `home-dashboard` so the delta specs here apply on top of them
- [x] 0.2 Write the design-system feature request `~/dev/design-system/feature-requests/review-container.md` in the format of the existing requests

## 1. Block type and storage

- [x] 1.1 `suggestion` block type: props schema (`action`, `targetId` required for replace and delete), no content, no `page`/`comment`/`suggestion` descendants; validation tests
- [x] 1.2 Migration `005_suggestions.sql` and the `suggestions` repository (SQLite and in-memory, shared contract tests): create, get, list pending by place, resolve (approved, rejected, withdrawn), reopen

## 2. Suggestion service

- [x] 2.1 `SuggestionService.suggest`: resolve the place (page or task body page), check position and target are in the page's own content, build the suggestion block and its children, store `base` for replace and delete; one transaction; tests for each action and each refusal
- [x] 2.2 Status with computed `outdated` (target missing or differs from `base`); tests for edit, delete, unchanged save
- [x] 2.3 `approve` (insert, replace with children moving under the first new block, delete; refuses outdated) and `reject`, each one batch plus the record update with a `snapshot`; tests for the agent-suggestions scenarios
- [x] 2.4 `withdraw` (author only, pending or outdated, no snapshot needed); `reopen` from the snapshot; `approveAll` / `rejectAll` for a page in document order, skipping outdated; tests

## 3. Edits and backlinks

- [x] 3.1 `checkPageEdit`: refuse inserting suggestions, changing or deleting a suggestion or anything inside one, and deleting a block that contains one; allow moving a suggestion as a whole, moving a block containing one, and editing its target; tests for the block-editor scenarios
- [x] 3.2 "Mentioned in" for pages and tasks skips sources with a suggestion ancestor; tests

## 4. Agent API and MCP

- [x] 4.1 Markdown: `anchors` option in `toMarkdown`, suggestions written as `<suggestion …>` blocks, importer drops trailing anchors and refuses `<suggestion` lines; round-trip tests
- [x] 4.2 `anchors` on `GET page/:id` and `GET task/:id/description`; `POST suggest`, `GET suggestion/:id` and `POST suggestion/:id/withdraw` with routes; permissions (`forbidden` for approve and reject, allowed on held work); tests for the agent-api scenarios
- [x] 4.3 MCP tools `suggest`, `get_suggestion`, `withdraw_suggestion`, and `anchors` on `read_page` and `read_description`; README; MCP test

## 5. Screens

- [x] 5.1 Review region (composed from `Card`, `Chip`, `Button` until the review container ships): author, action label, note, Outdated, Approve and Reject, struck-through target copy; pending count on the page. Read-only viewer and editor renderers
- [x] 5.2 Editor: `suggestion` in `block-types.ts` (non-text, caret skips it, no nesting into it, Backspace after it keeps it); approve and reject route actions that flush pending saves, call the service, reload the blocks and offer Undo until the next edit; Approve all / Reject all when more than one is pending
- [x] 5.3 Home dashboard "Waiting for review" section; view-builder tests
- [x] 5.4 Headless check of a page with insert, replace, delete and outdated suggestions (light and dark, phone width); typecheck and full test run
