## Context

`task-core` defined the chore lifecycle (`todo → done | cancelled`, with a `scope` input on `cancel`) and left chore attributes empty. The decisions captured there for this change were: urgency and schedule as attributes rather than subtypes, overdue chores become urgent, completing a scheduled chore creates the next occurrence, and cancel scope means skip (`occurrence`) or stop (`series`). The user then defined five schedule types: specific time, specific date, frequency, every X, and timer.

## Goals / Non-Goals

**Goals:**
- Schedules that cover one-off and recurring chores with a small, validated set of types.
- Due times that are correct across days, months and daylight-saving changes in the user's time zone.
- Recurring chores that never pile up: missed slots are skipped.

**Non-Goals:**
- Notifications, cron expressions, per-chore time zones, UI (see the proposal).

## Decisions

### 1. Everything lives in the task's attributes
`attributes = { urgency, schedule?, dueAt?, seriesId }`, validated by the chore kind's zod schema (a discriminated union on `schedule.type`). `dueAt` is an ISO timestamp derived from the schedule, stored so the dashboard can sort without recomputing. No new tables or columns: chores per project are few, and filtering and sorting happen in the domain like the other dashboard sections.

**Alternative considered:** a `chore_schedules` table. Rejected: one row per chore with no queries that need SQL-level filtering on schedule fields.

### 2. One-off types become a due time at creation
`time`, `date` and `timer` are resolved into `dueAt` when the chore is created (or rescheduled), against the clock and time zone. The schedule is kept in the attributes so the UI can show how the due time was set, but only recurring types are read again later.

### 3. Recurring due times follow the calendar
- **frequency:** the next slot is the next daily, weekly or monthly occurrence of the configured time after the previous due time. A monthly day past the month's end falls on its last day, so day 31 lands on Feb 28, Apr 30, and so on.
- **interval:** the next slot is the previous due time plus the interval.
- In both cases, slots that are not later than now are skipped, by repeated stepping for frequencies, or by arithmetic on the number of whole intervals elapsed for intervals.

This keeps "every Monday at 09:00" on Mondays even when a chore is completed late, and keeps "every 6 hours" on its rhythm.

**Alternative considered:** next due time = completion time + period. Rejected as the default: a weekly chore done late would drift to a different weekday each time. It can be added later as an option on `interval`.

### 4. Time zone and clock
All wall-clock schedule fields are interpreted in one **workspace time zone**, an option in `composition.ts` that defaults to the server's zone (`Intl.DateTimeFormat().resolvedOptions().timeZone`). Date arithmetic uses `@date-fns/tz` (`TZDate`) with `date-fns`, so adding a day across a daylight-saving change keeps 09:00 at 09:00. The clock comes from the injectable `now` already used by the services, so every scenario is testable at a fixed time.

**Alternative considered:** the `Temporal` API. It is the right long-term tool but is not reliably available without a flag on the Node 24 runtime used here; `date-fns` can be swapped out later behind the same functions.

### 5. Effective urgency is computed on read
`isUrgent(chore, now) = urgency === "urgent" || (state === "todo" && dueAt !== undefined && dueAt <= now)`. Stored urgency never changes by itself, so a rescheduled chore stops being urgent without anyone resetting a flag.

### 6. Next occurrence is a transition effect
The chore kind's `complete` effect, and `cancel` with scope `occurrence`, call a shared `createNextOccurrence` inside the transition's unit of work. It:
1. creates a new chore through the effect context's `createTask`, with the same project and title, attributes `{ urgency, schedule, seriesId, dueAt: next }`, and a new ID
2. copies the body page's children into the new body page with fresh block IDs, keeping order and nesting

Reference blocks are copied as-is, so they still point at the same targets. Comments are not copied.

The effect context gains `copyBody(fromTaskId, toTaskId)` and access to the clock and time zone, both provided by the task service.

### 7. A chore service for attribute changes
`ChoreService` (in `src/domain/chores/`) creates chores (resolving the schedule into `dueAt`), sets urgency, sets or clears the schedule, reports effective urgency, and lists a series. Attribute writes go through a new `TaskRepository.updateAttributes`. Only chores in `todo` can change.

### 8. The dashboard section is replaced, not edited
`composition.ts` calls `dashboardSections.replace` with a chores section that sorts by effective urgency, then `dueAt` (with no due time last), then recency, and adds `urgent` and `dueAt` to its items. `DashboardItem` gains those two optional fields.

## Risks / Trade-offs

- [Daylight-saving gaps: a 02:30 slot on a spring-forward day doesn't exist] → `TZDate` moves it forward to the first valid time; covered by a test.
- [The server's time zone is not the user's, e.g. a container on UTC] → The workspace time zone is configurable (`TIME_ZONE` environment variable); the default only matters when it isn't set.
- [Stored `dueAt` goes stale if the time zone setting changes] → Only future occurrences use the new zone; existing due times keep their instant. Acceptable for a single-user setting that rarely changes.
- [Copying a large body page on every recurrence] → Chore bodies are short checklists; the copy is one batch in the same transaction.

## Migration Plan

No schema migration. Existing chores have empty attributes; reading them applies the defaults (`urgency: normal`, `seriesId: own ID`, no schedule). The attribute schema accepts the empty object for them.

## Open Questions

- Should "every X" also offer "from completion" (a drifting interval) as an option? Assumed not, for now.
- Should a chore marked urgent go back to normal when it is rescheduled? Assumed no: urgency and schedule are independent.
