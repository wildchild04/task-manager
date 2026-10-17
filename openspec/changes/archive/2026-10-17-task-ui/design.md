## Context

`project-ui` added the projects home, dashboards, task lists, the library, and a read-only task overview at `/tasks/:taskId`. The domain behind a task is complete: `TaskService` (transitions with effects and history, relations, lineage), `CommentService` (add, edit by block batch, delete), and `ChoreService` (urgency, series). This change adds the task page's actions, following `project-ui`'s patterns: thin routes, view builders and action handlers in `app/lib/*.server.ts` tested against in-memory services, forms posted through fetchers.

## Goals / Non-Goals

**Goals:**
- Every domain operation on a single task reachable from its page, as the human actor.
- Starting an exploration or update from a task or comment in one step.
- Screen logic tested without a browser.

**Non-Goals:**
- Editing titles and bodies, rich-text comments, block pickers, schedule edits, agent actions (see the proposal).

## Decisions

### 1. One action per route, dispatched by `intent`
`/tasks/:taskId` gets one `action`. Every form posts a hidden `intent` (`transition`, `urgency`, `comment-add`, `comment-edit`, `comment-delete`, `reference-add`, `reference-remove`, `start-exploration`, `start-update`) handled by `taskAction(services, taskId, formData)` in `app/lib/task-actions.server.ts`. Transition forms also post `transition` (the transition's name) plus their inputs. Unknown intents are a 400.

Handlers return the existing `ActionResult`. Creating flows (promote, start exploration, start update) add `redirectTo` to the success result, and the route turns it into a `redirect`, so the fetcher navigates to the new task. Everything else returns `{ ok: true }`; the fetcher's revalidation re-renders the page with the new state.

**Alternative considered:** resource routes per operation (`/tasks/:id/comments`). More files for no gain: the page revalidates the same loader either way.

### 2. Transitions come from the kind definitions
The view builder lists `kinds[task.kind].transitions` whose `from` includes the current state, so the UI can never offer a transition the domain would reject for its state. Each gets a label and a form type:
- **direct** (start, pause, complete work, cancel work, reopen, tombstone, revive, cancel a chore that doesn't repeat): a button posting the transition
- **promote**: dialog with the title, prefilled
- **return**: dialog with the reason and optional description text
- **complete chore**: dialog with the follower question; the checkbox posts `next=yes` when checked, and the handler always sends `next` explicitly so the answer, not the default, decides. A chore due on a specific date gets no question and posts `next=no`
- **cancel repeating chore**: dialog with a radio, occurrence or series

Labels and form types live in one table in `app/lib/task-actions.server.ts`; a transition missing from the table falls back to a direct button labelled with its name, so a new kind's transitions still show up.

### 3. Plain text to paragraphs
Comments and return notes are a multiline `TextField`. `paragraphsFromText` splits on blank lines, trims, drops empty paragraphs, and keeps single newlines inside a paragraph. Each paragraph becomes `{ id: uuid, type: "paragraph", content: [{ text }] }`.
- **add comment**: `comments.add` with those blocks
- **edit comment**: one batch that deletes the body's current children and inserts the new paragraphs, through `comments.edit` (so it is marked edited and stays inside the comment). The edit field is prefilled with the comment's current text (block texts joined by blank lines); non-paragraph blocks become paragraphs. That loss is accepted until the editor exists, and the edit dialog says so when the comment has other block types.
- **return**: the reason goes to `input.reason`; the optional text becomes a `bodyBatch` inserting paragraphs after the body's last child.

### 4. Comment bodies use the page view model
`buildTreeView` in `page-view.server.ts` is generalized to build the children of any root, so `buildCommentView(blocks, bodyBlockId)` returns `ViewBlock[]` resolved and rendered exactly like page content (`Blocks`). References inside comments resolve the same way.

### 5. Reference targets become links on the server
`resolveTargetLink(services, ref)` turns a resolved relation into `{ kind, title, href } | { missing }`:
- **task**: `/tasks/:id`
- **comment**: `/tasks/:taskId#comment-:id`
- **block**: walk up to the nearest page ancestor, then its root's owner: a task body → `/tasks/:taskId`; a comment → that comment's task anchor; a project page or workspace page → `/pages/:pageId` of the nearest page

Adding a reference uses a `SearchSelect` of the project's other tasks (kind and title, filtered by text), excluding ones already referenced. "Referenced by" is `tasks.incoming({ kind: "task", id }, "references")`. "Referenced by" is kept to the task level; comments don't list what references them, to keep the page short.

### 6. Lineage rendered with `TreeNavigation`
The lineage is a `TreeNavigation` with every node expanded, items linking through React Router (`component` + `to`), and the current task as the active item. Labels are `Kind · Title · State`. Hidden when the tree is just the task itself.

### 7. Page layout
Title, chips and the transition bar at the top; then the body; then, in order, the sections that apply: Comments, Lineage, References, History. "Start exploration" and "Start update" sit in the transition bar, after the transitions, as outlined buttons.

### 8. The current page keeps its own dialogs
Each dialog component owns its `useFetcher`, like `project-ui`'s dialogs, so concurrent submissions don't share state and a dialog closes only on its own success. `FormDialog` is reused unchanged, with the hidden `intent` and `transition` fields as children.

## Risks / Trade-offs

- [Editing a comment that has non-paragraph blocks flattens them] → the edit dialog warns; real editing comes with the block editor.
- [A page with long history and many comments grows tall] → acceptable for now; history is last and could later collapse.
- [Redirects from fetcher actions] → React Router 7 follows a redirect returned to a fetcher by navigating, which is the wanted behaviour; covered by the route returning `redirect()` only for creating flows.
