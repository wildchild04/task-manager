## 1. Server foundations

- [x] 1.1 Generalize the page view builder to any root and add `buildCommentView` for comment bodies
- [x] 1.2 Add `paragraphsFromText` and the comment-text helper (blocks back to editable text)
- [x] 1.3 Add `resolveTargetLink` for task, comment and block references (nearest page, owner-based links, missing)

## 2. Task screen view

- [x] 2.1 Extend the task view: available transitions with labels and form types, chore urgency actions and follower defaults
- [x] 2.2 Add history (newest first, actor names, notes, formatted times)
- [x] 2.3 Add comments (work and chores only) with author, time, edited marker, rendered body and editable text
- [x] 2.4 Add lineage (hidden when alone or for chores) and references, "Referenced by", and the reference candidates

## 3. Task actions

- [x] 3.1 `taskAction` dispatch by intent; transition handler with promote, return, chore complete and chore cancel inputs; redirect for promote
- [x] 3.2 Urgency, comment add/edit/delete, reference add/remove handlers
- [x] 3.3 Start exploration (from a task or a comment) and start update (from done work), redirecting to the new task
- [x] 3.4 Tests for every `task-screen` scenario and the modified overview against in-memory services

## 4. Task page UI

- [x] 4.1 Route action wiring (`redirectTo` → `redirect`, unknown intent → 400)
- [x] 4.2 Transition bar and dialogs (promote, return, complete chore, cancel chore, start exploration, start update), urgency button
- [x] 4.3 Comments section: list, add form, edit and delete dialogs, start exploration from a comment
- [x] 4.4 Lineage, references (with add and remove) and history sections
- [x] 4.5 Component rendering tests; typecheck, full test run, and a manual check over HTTP against the dev database

## 5. Page breadcrumbs

- [x] 5.1 Build a page's breadcrumb trail (project, library, containing pages) and show it on `/pages/:pageId` instead of the back link
