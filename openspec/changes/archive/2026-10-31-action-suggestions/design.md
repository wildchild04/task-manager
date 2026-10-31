## Context

Suggestions today are block changes only:
- **Storage:** a `suggestions` record plus a `suggestion` block on the page, holding the proposed blocks.
- **Review:** the human reviews them in place, with approve, reject, Undo, and approve all or reject all.
- **Withdrawing and outdated:** an agent can withdraw its own suggestion. A suggestion is outdated when its target changed.
- **Notifications:** the bell and "Waiting for review" group pending suggestions by place (page or task).

Agents can create tasks and pages, and apply every transition. They can't rename or delete anything, change a schedule, or create a project.

The decision behind this change, from the findings on "What agents are allowed to do":
- **Direct:** creation.
- **Through approval:** edits and deletions.
- **Transitions:** only the ending ones need approval. An agent's working flow stays direct.
- **Where suggestions show:** where the human's own controls are, and as notifications.

Every title is a page title:
- a project's title is its home page's;
- a task's title is its body page's.

Every action needed already exists as a domain call:
- `ProjectService.delete`
- `TaskService.delete`
- `TaskService.transition`
- `ChoreService.setSchedule`
- a block batch: `update` of a page block's content to rename it, `delete` of a page block to delete it.

`SqliteUnitOfWork.run` nests: better-sqlite3 runs inner transactions as savepoints. `MemoryUnitOfWork` restores from the outer snapshot. So an approval can run these calls inside its own unit of work.

## Goals / Non-Goals

**Goals:**
- Agents can suggest the following, and the human approves or rejects at the matching control:
  - renaming a project, page or task;
  - deleting a project, page or task;
  - changing a chore's schedule;
  - an ending transition.
- One suggestion model. Status, withdraw, `get_suggestion`, the bell and "Waiting for review" work the same for block and action suggestions.
- Agents create projects directly.
- Agents can no longer apply ending transitions directly.

**Non-Goals:**
- Revising a suggestion before approval, and comments on suggestions. This belongs to the exploration "Revising suggestions before approval".
- Per-agent permissions, and human accounts.
- Undo after approving an action suggestion. Deletions can't be undone today either. Rejecting an action suggestion has nothing to put back.
- Suggesting a chore's urgency, or other task fields.

## Decisions

### One table: an action suggestion is a suggestion with a subject

Migration `007_action_suggestions.sql` rebuilds `suggestions`, because SQLite can't change a CHECK in place. It adds:
- `subject_kind`: `project`, `page` or `task`. Null for block suggestions.
- `subject_id`
- `payload`: JSON with the new title, the schedule, or the transition and scope.

`action` gains three values: `rename`, `schedule` and `transition`. `delete` is shared:
- with a subject, it's an action;
- without one, it's a block delete.

The checks are:
- a block action has no subject and has a `suggestion` block;
- an action has a subject;
- `target_id` is only for `replace` and block `delete`.

`page_id` stays required. For an action suggestion it holds the subject's **place page**:
- a project's home page;
- the page itself;
- a task's body page.

Grouping by place, the bell and `GET suggestion/:id`'s `place` therefore keep working unchanged.

In the domain, `Suggestion` becomes a union discriminated by `subject`:
- `BlockSuggestion`: `subject: null`, the existing fields;
- `ActionSuggestion`: `subject: { kind, id }`, `payload`, and `action: "rename" | "delete" | "schedule" | "transition"`.

`base` holds what the action was checked against, as JSON (see Outdated).

*Alternative considered:* a separate `action_suggestions` table. That would mean two status models, two withdraw paths and two bell queries. Revising suggestions would also have to be built twice. Rejected.

### What can be suggested

| `action` | subject | payload | Approving runs |
|---|---|---|---|
| `rename` | project, page, task | `{ title }` (non-empty, plain text) | a block `update` of the place page's content to `[{ text: title }]` |
| `delete` | project | – | `ProjectService.delete` |
| `delete` | page | – | the page block's `delete`. Only pages that page-deletion allows (not project roots or task bodies). |
| `delete` | task | – | `TaskService.delete` |
| `schedule` | task (a chore in `todo`) | `{ schedule }` (the `chore-scheduling` schedule, or `null` to remove it) | `ChoreService.setSchedule` |
| `transition` | task | `{ name, scope? }` | `TaskService.transition` with the human as actor |

The only transitions that can be suggested are the **ending** ones:
- work `cancel`;
- exploration and update `tombstone`;
- chore `cancel` with `scope: "series"`.

A suggestion is refused with `validation` when:
- the subject kind doesn't fit the action;
- the transition isn't one of these;
- the transition isn't allowed from the subject's current state;
- a schedule is invalid, or given to a non-chore or a chore that isn't in to do;
- a title is empty.

A missing subject is refused with `not_found`.

A suggestion is checked when it is made, so an agent can't propose what the human couldn't do either.

### Outdated

A pending action suggestion is reported as `outdated` when its subject is gone, or when `base` no longer matches the subject:

| `action` | `base` |
|---|---|
| `rename` | the current title |
| `delete` of a project or page | `null`: only the subject being gone makes it outdated |
| `delete` of a task | `null`: only the subject being gone makes it outdated |
| `schedule` | the task's state and its configured schedule |
| `transition` | the task's state |

Approving an outdated suggestion is refused. Rejecting and withdrawing still work. This is the same rule as for block suggestions.

When one of two competing rename suggestions is approved, the other becomes outdated. Once a subject is deleted, every pending action suggestion on it becomes outdated. Pending block suggestions on pages that a project or task deletion removed already drop out of `listPending` today: the deletion removes their blocks. Action suggestions whose subject is gone drop out the same way: `listPending` keeps only those whose subject still exists.

### Approving runs the existing domain call through a port

`SuggestionService` stays free of the other services. It takes an `ActionRunner` port from composition, with one method:

```ts
run(subject, action, payload): void
```

`createServices` implements the port with:
- `projects.delete`, `tasks.delete`, `tasks.transition` (`actor: { kind: "human" }`) and `chores.setSchedule`;
- a block batch for renames and page deletions.

`approve(id)` runs inside one unit of work:
1. check the suggestion is pending and not outdated;
2. call the runner;
3. set the record to `approved`, with `undo: null`.

A domain error from the runner rolls the whole approval back, and comes back as a `SuggestionError("validation", message)`.

`reject` and `withdraw` set the record's status and touch no blocks. `reopen` refuses action suggestions, because they have no `undo`. `approveAll` and `rejectAll` stay limited to block suggestions in the page's content. They don't include the place's action suggestions, because those are decided where they show.

### Where action suggestions show

A new `ActionSuggestionBar` component renders one pending action suggestion:
- the agent's name and the action in words:
  - "suggests renaming to "Roadmap 2027""
  - "suggests deleting this page (and 2 pages inside)"
  - "suggests changing the schedule to Every Monday at 09:00"
  - "suggests cancelling this work"
- the note;
- "Outdated" when it is;
- **Approve**, which is hidden when the suggestion is outdated, and **Reject**.

It uses the same yellow suggestion styling as the block region.

Approving a `delete` opens the same confirmation dialog as the delete button, with the same counts. Confirming approves the suggestion.

Bars are placed where the human's own control is:

| Screen | Action suggestions shown |
|---|---|
| Project home (`/projects/:id`) | rename, under the title; delete, by the delete button |
| Page (`/pages/:id`) | rename, under the title; delete, by the delete button |
| Task (`/tasks/:id`) | rename, under the title; delete, by the delete button; `schedule` and `transition`, right under the actions row (which holds the schedule button) |

Several pending suggestions of the same action stack, oldest first.

The loaders get `suggestions.pendingActions(placePageId)`. Decisions go through the existing `/api/suggestions` resource route (`approve` and `reject` by ID), and live refresh re-runs the loaders.

After approving a deletion, the browser goes where the delete button would have taken it. The resource route answers with `redirectTo`, and the bar navigates.

### Bell and "Waiting for review"

`suggestionPlaces` already groups `listPending()` by `page_id`, so action suggestions are counted with no new query.

The detail line names the action when the place has exactly one pending suggestion and it is an action, for example "Suggests deleting · claude". Otherwise it keeps "N suggestions · agents".

A place whose only suggestions are actions on a project links to the project home rather than to `/pages/<home page>`. `placeOf` already resolves a home page that way.

### Agent API and MCP

- **Creating projects:** `POST projects` with `{ title }` returns `{ ok: true, id }`. It creates the project with a new ID, through `ProjectService.create`. MCP: `create_project`.
- **Suggesting an action:** `POST suggest-action` takes:

  ```
  { action, project? | page? | task?, title?, schedule?, transition?, scope?, note? }
  ```

  Exactly one subject, given as an ID or 8-character prefix. It returns `{ ok: true, id }`. MCP: `suggest_action`.
- **Errors:** as for `POST suggest`, with codes `validation`, `not_found` and `forbidden`.
- **`GET suggestion/:id`:** adds `subject: "project:<id>" | "page:<id>" | "task:<id>"` for action suggestions. `action` is now one of `insert`, `replace`, `delete`, `rename`, `schedule` or `transition`.
- **Ending transitions are removed from agents, not specially handled:** `allowedTransitions` leaves them out, so `GET task/:id` doesn't list them. `POST task/:id/transition` refuses them with the generic 403 `forbidden`, like any change agents can't make; the server must still check, since an agent can send any name. `suggest_action`'s description is where agents learn that these can be suggested. There's no extra `suggest` field and no special error message.

*Alternative considered:* one `suggest` endpoint with both modes. Rejected: its `action` and `target` fields already mean block things.

## Risks / Trade-offs

- **Rebuilding `suggestions` in a migration:** the risk is losing records. The migration copies every row into the new table in one transaction. A migration test runs against a copy of a database with block suggestions in it.
- **Approval failing in the runner:** a domain check can fail on approval even though the suggestion isn't outdated, for example deleting a page that can't be deleted. The whole approval is rolled back, and the domain's message is shown in the bar.
- **Agents that cancel today:** an agent that sends `cancel` or `tombstone` gets `forbidden`. Only our own agents are affected, and `suggest_action`'s description covers the alternative.
- **Bars crowding a screen:** several suggestions on one task (rename + schedule + transition) stack in three places. That's acceptable at the expected volume. The bell still counts the place once.

## Migration Plan

1. Deploy migration 007 with the app. Existing block suggestions keep their status and their blocks.
2. Run `just install-mcp` and reconnect both MCP servers to get `create_project` and `suggest_action`.
3. To roll back: there's no down migration. Rows with the new actions would violate the old CHECK, so they would have to be deleted by hand before going back to the previous version. That's acceptable on the homelab.

## Open Questions

- Should approving a `transition` record "suggested by *agent*" in the task's history, beyond the human as actor? Leaning no for now. The suggestion record keeps the author.
