## 1. Schedules and due times

- [ ] 1.1 Add `date-fns` and `@date-fns/tz` (clean reinstall afterwards, see the npm optional-dependency note)
- [ ] 1.2 Define the schedule types and the chore attribute schema (zod discriminated union; HH:MM, YYYY-MM-DD, weekday 1–7, dayOfMonth 1–31, amounts ≥ 1)
- [ ] 1.3 Implement `firstDue(schedule, now, timeZone)` for all five types
- [ ] 1.4 Implement `nextDue(schedule, previousDue, now, timeZone)` for `frequency` and `interval`, skipping slots not later than now
- [ ] 1.5 Unit-test every due-time scenario in the spec, plus month-end clamping and a daylight-saving change, at fixed clocks

## 2. Chore domain

- [ ] 2.1 Replace the chore kind's attribute schema; apply defaults (`urgency: normal`, `seriesId: id`) when reading chores with empty attributes
- [ ] 2.2 Add `TaskRepository.updateAttributes` to the port and both implementations
- [ ] 2.3 Give the task service a workspace time zone and expose the clock, time zone and a `copyBody` helper on the effect context
- [ ] 2.4 Implement body copying (children with fresh IDs, order and nesting kept, references copied as-is)
- [ ] 2.5 Implement `createNextOccurrence` and call it from `complete` and from `cancel` with scope `occurrence`; reject `series` unless the schedule is recurring
- [ ] 2.6 Implement `ChoreService`: create (resolving `dueAt`), set urgency, set or clear schedule (todo only), `isUrgent`, list a series

## 3. Dashboard and composition

- [ ] 3.1 Add `urgent` and `dueAt` to `DashboardItem`, and replace the `chores` section with the urgency, due time and recency order
- [ ] 3.2 Add the workspace time zone option (`TIME_ZONE`, default the server's zone) and wire `ChoreService` into `composition.ts`

## 4. Tests and verification

- [ ] 4.1 Contract suite for every chore-scheduling scenario, against both stores, with a fixed clock
- [ ] 4.2 Update the dashboard contract with the urgent-chores-first scenario
- [ ] 4.3 Confirm `typecheck`, the full test suite and `build` pass
