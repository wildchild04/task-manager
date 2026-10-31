## Context

Comments (`src/domain/comments/`) are task records with an author, timestamps and an owned `comment` root block. Their content is protected so it changes only through `CommentService`. They're allowed on work and chores; `COMMENTABLE_KINDS` refuses them on explorations and updates. The task page renders them with `TaskComments`, the agent API reads and writes them in `app/lib/agent/functions.server.ts` behind `checkWork`, and deleting a task deletes them in `deleteTaskWithin`.

A finding is the same thing in every respect but three: which task kinds take it, where it's shown, and who may edit it through the agent API.

## Goals / Non-Goals

**Goals:** findings on explorations, written and managed by you on the page and by agents through the API and MCP, with no approval and agents editing only their own. Reuse the comment machinery instead of building a parallel one.

**Non-Goals:** see the proposal. In short: no findings outside explorations, no copying on promote, no types or replies.

## Decisions

### A finding is a comment record of kind `finding`

Add `kind: "comment" | "finding"` to `Comment`, stored in a new `kind` column on `comments` (`NOT NULL DEFAULT 'comment'`, `CHECK` against the two values). Findings keep the `comment` root block type, the `comment:<id>` owner and its protection, and the forbidden block types.

`CommentService` takes the kind on `add` and checks it against the task's kind through one table: comments on work and chores, findings on explorations. `list(taskId, kind)` and the repositories' `listByTask(taskId, kind?)` filter by kind; without a kind they return everything, which is what task deletion needs. `edit` and `delete` work the same for both kinds.

*Alternative: a separate `findings` table, repository, service, owner kind and root block type.* That duplicates around 300 lines (two repositories, a service, a migration, protection and composition wiring) for no difference in behaviour. If findings later need their own fields, such as a type or resolved state, they can still get a column of their own or be split out then.

*Alternative: a "Findings" heading inside the description that agents may append under.* That was rejected when choosing the shape: it has no author or date per finding, and it would open the description to agent writes.

### Who may edit what

The API checks, in `functions.server.ts`:
- `POST task/:id/finding` requires an exploration; any other kind is refused with 422 (code `validation`, from the service). `checkWork` isn't applied, so this is the one write agents may make on an idea. The claiming rules don't apply, because only work is claimed.
- `POST finding/:id` and `POST finding/:id/delete` require the finding's author to be the calling agent, or 403 (code `forbidden`). A comment ID passed to them, or a finding ID passed to the comment functions, is 404 (code `not_found`), so the two record types never leak into each other's functions.
- Editing an agent's finding replaces its whole content with the new Markdown: delete the body's children, then insert the new blocks, as one `CommentService.edit` batch, which marks the finding as edited.

On the page, you can edit and delete any finding, as with comments. The app has a single user, and agents' findings are part of your workspace.

### UI: generalize `TaskComments`

`TaskComments` becomes a list of records parameterized by labels and anchors: the button ("Comment" or "Add finding"), the empty state, the hash prefix (`comment-` or `finding-`), and the action intents. `task-overview.server.ts` builds `findings` for explorations the way it builds `comments` for work and chores. In `task.tsx`, the tab list gets `findings` for explorations, between Description and Lineage, and the hash handling opens the Findings tab for `#finding-<id>`. The task actions reuse the comment handlers with the kind checked against the record: a `commentOf` lookup that also matches the kind.

"Start exploration from this comment" isn't offered on findings.

### Agent reads

`GET task/:id/findings` mirrors `GET task/:id/comments` (newest first, `limit` default 5, `maxChars` default 1000, paging by `cursor`), so an agent catching up reads the latest results first. `GET task/:id` adds `findings` to `counts` for explorations only, so the other kinds' answers stay as they are.

## Risks / Trade-offs

- [A query that forgets the kind filter mixes findings into comments] → The repositories take the kind, every read path in the app and the API passes it, and the repository tests list a table holding both kinds per kind.
- [Data that already exists] → The migration defaults every existing row to `comment`, and no exploration has comments, so nothing changes meaning.
- [Agents filling explorations with noise] → Every finding shows its author, and you can delete it on the page. Approval was considered and rejected.

## Migration Plan

`006_findings.sql` adds the column with its default. It's additive; rolling back the code leaves the rows readable as comments on explorations, which the old UI hides. Deploying is the usual push to the homelab.

## Open Questions

None.
