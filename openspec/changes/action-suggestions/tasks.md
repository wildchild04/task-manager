## 1. Storage and domain

- [x] 1.1 `db/migrations/007_action_suggestions.sql`: rebuild `suggestions` with `subject_kind` (`project`|`page`|`task`), `subject_id`, `payload`, and `action` in `insert`, `replace`, `delete`, `rename`, `schedule`, `transition`; checks: subject both-or-neither, `target_id` only for block replace/delete, `rename`/`schedule`/`transition` need a subject; copy every row; a migration test on a database with block suggestions
- [x] 1.2 `src/domain/suggestions/types.ts`: `BlockSuggestion | ActionSuggestion` (subject, payload, actions); SQLite and in-memory repositories store and read both; repository contract tests
- [x] 1.3 `SuggestionService.suggestAction` with the validation of the action-suggestions spec (subject kinds, ending transitions allowed from the current state, schedule via `scheduleSchema` on a chore in to do, non-empty title, deletable page, note length), `base` as in the design; place page per subject; tests
- [x] 1.4 Outdated for actions (subject gone, title/schedule/state changed); `listPending` keeps action suggestions only while their subject exists; `pendingActions(placePageId)`; tests including competing renames and a deleted subject
- [x] 1.5 `ActionRunner` port, implemented in `src/composition.ts` (`projects.delete`, `tasks.delete`, `tasks.transition` as human, `chores.setSchedule`, block batch for page rename/delete); `approve` runs it in one unit of work, refusing outdated and rolling back on a domain error; `reject`/`withdraw` touch only the record; `reopen` refuses actions; `approveAll`/`rejectAll` stay block-only; tests for each action with the memory and SQLite stores

## 2. Screens

- [x] 2.1 `ActionSuggestionBar` component: agent, action in words (schedule via the existing schedule label), note, Outdated, Approve/Reject posting to `/api/suggestions`; delete approval through the existing delete dialogs (project, page, task) with their counts; `decideSuggestion` returns `redirectTo` after an approved delete
- [x] 2.2 Loaders for project home, page and task load pending action suggestions for their place page; bars placed under the title, by the delete button, under the chore's schedule button and in the task's actions row
- [x] 2.3 `home.server.ts`: places with action suggestions in the bell and "Waiting for review" (project places link to the project home; "Suggests deleting · agent" when the only one is an action); tests in the screen and home tests

## 3. Agent API and MCP

- [x] 3.1 `functions.server.ts`/`request.server.ts`: `POST projects`; `POST suggest-action` (exactly one subject, fields per action, prefixes resolved); `subject` in `GET suggestion/:id`; `withdraw` for actions
- [x] 3.2 Ending transitions removed from agents: `allowedTransitions` leaves them out of `GET task/:id`, and `POST task/:id/transition` refuses them with the generic `forbidden`
- [x] 3.3 `mcp/tools.ts`: `create_project`, `suggest_action`; `mcp/README.md`; tests in `tests/app/agent-api.test.ts` and `tests/mcp.test.ts` (23 tools)

## 4. Check

- [x] 4.1 Typecheck, unit tests, Playwright suite; a Playwright spec suggesting a page delete and a task rename through the API, approving the rename and the delete from their bars, and seeing the bell follow
- [x] 4.2 Try it on the dev instance through `notion-tasks-dev` (after `just install-mcp` and `/mcp` reconnect): create a project, suggest each action kind, approve and reject from the screens
