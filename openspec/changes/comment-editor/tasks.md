## 1. Server

- [x] 1.1 `comment` surface for edits (scope check, applied through `CommentService.edit`); `/api/comments/:id/editable`; tests
- [x] 1.2 `comment-add` takes the editor's blocks as JSON (shape check, empty check); remove the plain-text edit path; comment views carry mention targets; tests

## 2. Editor

- [x] 2.1 Draft mode for `PageEditor` (local tree, no saving, `onDraftChange`, Cmd/Ctrl+Enter submit, empty-state text)
- [x] 2.2 Comment composer (post, clear on success, show errors) and in-place editing (Edit → editor saving through the comment surface → Done)
- [x] 2.3 Headless check of every scenario; typecheck and full test run
