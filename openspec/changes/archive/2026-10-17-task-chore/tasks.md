## 1. Schedules and due times

- [x] 1.1 Add `date-fns` and `@date-fns/tz` (clean reinstall afterwards, see the npm optional-dependency note)
- [x] 1.2 Define the schedule types and the chore attribute schema (zod discriminated union; HH:MM, YYYY-MM-DD, weekday 1–7, dayOfMonth 1–31, amounts ≥ 1)
- [x] 1.3 Implement `firstDue(schedule, now, timeZone)` for all five types
- [x] 1.4 Implement `nextDue(schedule, previousDue, now, timeZone)` for `frequency` and `interval`, skipping slots not later than now
- [x] 1.5 Unit-test every due-time scenario in the spec, plus month-end clamping and a daylight-saving change, at fixed clocks

## 2. Chore domain

- [x] 2.1 Replace the chore kind's attribute schema (`urgency`, `baseUrgency`, `schedule`, `dueAt`, `seriesId`); apply defaults when reading chores with empty attributes
- [x] 2.2 Add `TaskRepository.updateAttributes` to the port and both implementations
- [x] 2.3 Give the task service a workspace time zone and expose the clock, time zone and a `copyBody` helper on the effect context
- [x] 2.4 Implement body copying (children with fresh IDs, order and nesting kept, references copied as-is)
- [x] 2.5 Add the `next` input to `complete` (default yes when recurring); implement `createNextOccurrence` (base urgency, schedule carried, due time per schedule type, `date` rejects `next: yes`) and call it from `complete` and from `cancel` with scope `occurrence`; reject `series` unless the schedule is recurring
- [x] 2.6 Implement `ChoreService` (creation goes through the kind's `initialize` hook, see design 10): set urgency (occurrence only), set or clear schedule (configuration), todo only, `isUrgent`, list a series

## 3. Dashboard and composition

- [x] 3.1 Add `urgent` and `dueAt` to `DashboardItem`, and replace the `chores` section with the urgency, due time and recency order
- [x] 3.2 Add the workspace time zone option (`TIME_ZONE`, default the server's zone) and wire `ChoreService` into `composition.ts`

## 4. Tests and verification

- [x] 4.1 Contract suite for every chore-scheduling scenario, against both stores, with a fixed clock
- [x] 4.2 Update the dashboard contract with the urgent-chores-first scenario
- [x] 4.3 Confirm `typecheck`, the full test suite and `build` pass
