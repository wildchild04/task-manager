## Why

Chores are repetitive or time-bound work that needs attention: updating a library, renewing a certificate, checking something in 30 minutes. `task-core` gave chores a lifecycle but no notion of urgency or time. This change adds urgency, due times and schedules, so overdue chores become urgent and recurring chores keep coming back.

## What Changes

- Chores get an **urgency** (`normal` or `urgent`) and an optional **schedule**, as attributes rather than subtypes.
- Five **schedule types**:
  - one-off: **specific time** (HH:MM, the next time it comes round), **specific date** (a date and a time), **timer** (X minutes from now)
  - recurring: **frequency** (daily, weekly or monthly at a time) and **every X** (a fixed interval of minutes, hours, days or weeks, for cron-like jobs)
- A chore with a schedule has a **due time**. A chore in `todo` whose due time has passed **counts as urgent**, computed when read.
- Completing a chore **answers "create a following chore with the same configuration?"**: yes by default for recurring chores (the next slot on the schedule's calendar, missed slots skipped), no by default for one-off ones. The following chore is in the same series, with a copy of the body page.
- **Promoting a chore to urgent keeps its original configuration**: it affects that occurrence only, and the next occurrence returns to the configured urgency.
- **Cancel scope** gets its effects: `occurrence` on a recurring chore skips to the next occurrence; `series` ends the schedule.
- Urgency (per occurrence) and schedule (configuration, carried forward) can be changed while a chore is in `todo`.
- The dashboard's **chores** section lists urgent chores first, then by due time, and its items show urgency and due time. **BREAKING** for that section's order only.

## Capabilities

### New Capabilities
- `chore-scheduling`: chore attributes, schedule types, due times, effective urgency, next occurrences, cancel scope effects, changing urgency and schedule, series.

### Modified Capabilities
- `project-dashboard`: the `chores` section's order and item fields change.

## Non-goals

- Notifications or reminders when a chore becomes due.
- Cron expressions (`*/15 * * * *`). "Every X" covers fixed intervals; full cron syntax can be added later as another schedule type.
- Per-chore time zones. All schedules use the workspace time zone.
- Agent workflows for chores, and any UI.

## External dependencies

None. This change has no UI. (The scheduling UI will need the design system's `DatePicker` and a time input.)

## Prerequisites

- `task-core` and `project-structure` (applied and archived).

## Impact

- `src/domain/tasks/kinds/index.ts`: the chore attribute schema, the `complete` and `cancel` effects.
- New `src/domain/chores/`: schedule types, due-time calculation, the chore service.
- `composition.ts`: the workspace time zone option, and the `chores` dashboard section replaced.
- New dependency for time-zone-aware date arithmetic.
- No migration: urgency, schedule, due time and series live in the task's `attributes` JSON.
