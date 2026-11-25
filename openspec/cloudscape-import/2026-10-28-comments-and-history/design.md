## Event record

```
TaskEvent { id, taskId, type, actor, targetId, detail, at }
```

`task_events` (migration 012). `type` is one of `TASK_EVENT_TYPES`; `targetId` names what it was about (comment, entry, suggestion, referenced entity); `detail` is a short value to show (new title, urgency, step title, transition name, referenced kind). Transitions, step changes and flags keep their own tables; the history view merges all four.

## Recording

`recordTaskEvent(repos, event, at)` runs inside the caller's unit of work, so an event commits with its change or not at all. Services record their own changes; the page editor's task edits (title and description) go through `TaskService.recordEvent` after the batch applies, since the block service doesn't know about tasks. Events take their own random IDs rather than a service's injected `newId`, so deterministic ID sequences in tests are unchanged.

Coalescing: `description_edited`, `comment_edited` and `diagnostic_edited` update the task's latest event instead of adding one when it has the same type, target and actor and is within 10 minutes.

Actors: services that only the human reaches (references, urgency, schedule, comment edits and deletes from the page, approving and rejecting) record the human; agent paths pass the agent (create, comment, steps, diagnostic replace, description append).

## Reading

`historyEntries(services, task)` returns every entry with its raw actor and ISO time; the task page formats them (`historyView`), and `GET task/:id/history` pages them with the agents' cursor. Labels come from `eventText`, resolving titles (a referenced task, a comment's first line) at read time.
