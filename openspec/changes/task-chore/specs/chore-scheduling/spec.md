## ADDED Requirements

### Requirement: Chore attributes
A chore SHALL have an `urgency` of `normal` or `urgent` (default `normal`) and MAY have a `schedule`. Its **configuration** is its `baseUrgency` (the urgency it was created with) and its schedule; occurrences that follow it copy the configuration. A chore with a schedule SHALL have a `dueAt` time computed from it. Every chore SHALL have a `seriesId`: its own ID for the first chore of a series, and the first chore's ID for every later occurrence. Attributes that do not match these rules SHALL be rejected.

#### Scenario: Plain chore
- **WHEN** a chore is created with no attributes
- **THEN** its urgency and base urgency are `normal`, it has no schedule and no due time, and its `seriesId` is its own ID

#### Scenario: Invalid urgency
- **WHEN** a chore is created with urgency `critical`
- **THEN** creation is rejected with a validation error

### Requirement: Schedule types
A schedule SHALL be one of the following. Times are `HH:MM` in 24-hour form, and all schedules are interpreted in the workspace time zone.

| Type | Fields | Recurring | Due time when the chore is created |
|---|---|---|---|
| `time` | `time` | no | today at `time` if that is later than now, otherwise tomorrow at `time` |
| `date` | `date` (YYYY-MM-DD), `time` | no | that date at `time` (may already be past) |
| `timer` | `minutes` (at least 1) | no | now plus `minutes` |
| `frequency` | `every`: `daily`, `weekly` or `monthly`; `time`; `weekday` (1 = Monday … 7 = Sunday) for weekly; `dayOfMonth` (1–31) for monthly | yes | the first slot later than now |
| `interval` | `amount` (at least 1) and `unit`: `minutes`, `hours`, `days` or `weeks` | yes | now plus the interval |

A monthly `dayOfMonth` beyond the end of a month SHALL fall on that month's last day. A schedule with missing or invalid fields SHALL be rejected.

#### Scenario: Specific time later today
- **WHEN** at 08:00 a chore is created with schedule `time` 09:00
- **THEN** it is due today at 09:00

#### Scenario: Specific time already passed
- **WHEN** at 10:00 a chore is created with schedule `time` 09:00
- **THEN** it is due tomorrow at 09:00

#### Scenario: Specific date
- **WHEN** a chore is created with schedule `date` 2026-11-03 at 14:30
- **THEN** it is due on 2026-11-03 at 14:30

#### Scenario: Timer
- **WHEN** at 10:00 a chore is created with a 30-minute timer
- **THEN** it is due at 10:30

#### Scenario: Weekly frequency
- **WHEN** on Wednesday a chore is created with schedule weekly on Monday at 09:00
- **THEN** it is due next Monday at 09:00

#### Scenario: Monthly on the 31st
- **WHEN** on 2026-02-10 a chore is created with schedule monthly on day 31 at 09:00
- **THEN** it is due on 2026-02-28 at 09:00

#### Scenario: Every X
- **WHEN** at 10:00 a chore is created with schedule every 6 hours
- **THEN** it is due at 16:00

#### Scenario: Invalid schedule
- **WHEN** a chore is created with schedule `time` 25:00
- **THEN** creation is rejected with a validation error

### Requirement: Overdue chores are urgent
A chore SHALL be reported as urgent when its urgency is `urgent`, or when it is in `todo` and its due time has passed. This SHALL be computed when the chore is read; the stored urgency SHALL NOT change.

#### Scenario: Overdue
- **WHEN** a chore with normal urgency is due at 09:00 and it is now 09:01
- **THEN** the chore is reported as urgent and its stored urgency is still `normal`

#### Scenario: Done chores are not overdue
- **WHEN** an overdue chore is completed
- **THEN** it is no longer reported as urgent

### Requirement: Next occurrence
`complete` SHALL take an optional `next` answer to "create a following chore with the same configuration?". It defaults to yes for a chore with a recurring schedule and to no otherwise. When the answer is yes, completing SHALL, in the same transaction, create the following chore: a new chore in the same project and series, with the same title, the configuration (`urgency` set to the `baseUrgency`, the same schedule), and a copy of the body page's content.

- For a **recurring** schedule, its due time SHALL be the first slot on the schedule after the completed chore's due time that is later than now, so missed slots are skipped.
- For a **`time` or `timer`** schedule, its due time SHALL be resolved again from now, as at creation.
- A **`date`** schedule cannot be repeated with the same configuration; `next: yes` SHALL be rejected for it.
- A chore **without a schedule** SHALL be repeated with no due time.

When the answer is no, no further chore SHALL be created; for a recurring chore that ends the series.

#### Scenario: Daily chore completed on time
- **WHEN** a daily 09:00 chore due today is completed at 09:15
- **THEN** a new chore in the same series is due tomorrow at 09:00

#### Scenario: Missed slots are skipped
- **WHEN** a daily 09:00 chore due on Monday is completed on Thursday at 10:00
- **THEN** the next occurrence is due on Friday at 09:00

#### Scenario: Interval keeps its rhythm
- **WHEN** an every-6-hours chore due at 12:00 is completed at 12:30
- **THEN** the next occurrence is due at 18:00

#### Scenario: Body is copied
- **WHEN** a recurring chore whose body page holds a checklist is completed
- **THEN** the next occurrence's body page holds the same checklist, as new blocks

#### Scenario: One-off chore does not recur by default
- **WHEN** a chore with a timer schedule is completed without a `next` answer
- **THEN** no new chore is created

#### Scenario: Repeat a timer chore
- **WHEN** at 11:00 a chore with a 30-minute timer is completed with `next: yes`
- **THEN** a following chore in the same series is due at 11:30

#### Scenario: Stop a recurring chore at completion
- **WHEN** a weekly chore is completed with `next: no`
- **THEN** it is `done` and no next occurrence exists

#### Scenario: A specific date cannot repeat
- **WHEN** a chore with a `date` schedule is completed with `next: yes`
- **THEN** the completion is rejected and the chore stays in `todo`

#### Scenario: Promotion to urgent is not carried over
- **WHEN** a normal weekly chore is marked urgent and then completed
- **THEN** the next occurrence has urgency `normal` and the same weekly schedule

### Requirement: Cancel scope effects
Cancelling a chore with a recurring schedule with scope `occurrence` SHALL cancel it and create the next occurrence, exactly as completing it with `next: yes` would. Scope `series` SHALL cancel it and create no further occurrence. For a chore without a recurring schedule, only `occurrence` SHALL be valid.

#### Scenario: Skip one occurrence
- **WHEN** a weekly chore is cancelled with scope `occurrence`
- **THEN** it is `cancelled` and the next week's occurrence exists

#### Scenario: End the series
- **WHEN** a weekly chore is cancelled with scope `series`
- **THEN** it is `cancelled` and no next occurrence exists

#### Scenario: Series scope on a one-off chore
- **WHEN** a chore with a date schedule is cancelled with scope `series`
- **THEN** the cancellation is rejected

### Requirement: Changing urgency and schedule
A chore's urgency and schedule SHALL be changeable while it is in `todo`. Setting the urgency (for example promoting a chore to urgent) SHALL change that occurrence only: its `baseUrgency` and schedule SHALL stay as configured. Changing the schedule SHALL change the configuration, recompute the due time from now, and be carried to later occurrences; removing it SHALL clear the due time. Neither change SHALL affect chores that already exist in the series.

#### Scenario: Mark urgent
- **WHEN** a normal chore's urgency is set to `urgent`
- **THEN** it is reported as urgent, and its base urgency and schedule are unchanged

#### Scenario: Reschedule
- **WHEN** at 10:00 a chore's schedule is changed to a 15-minute timer
- **THEN** it is due at 10:15

#### Scenario: Done chores cannot change
- **WHEN** the urgency of a done chore is changed
- **THEN** the change is rejected

### Requirement: Series
The system SHALL list the chores of a series, oldest first.

#### Scenario: List a series
- **WHEN** a daily chore has been completed twice
- **THEN** its series lists three chores: two done and one in `todo`
