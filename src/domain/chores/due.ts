import { TZDate } from "@date-fns/tz";
import { addDays, addMinutes, addMonths, addWeeks, getDaysInMonth, getISODay } from "date-fns";

import type { Schedule } from "./schedule";

/** A wall-clock moment in `timeZone`. Times that don't exist (spring forward) move forward. */
function wallClock(day: TZDate, time: string, timeZone: string): TZDate {
  const [hours, minutes] = time.split(":").map(Number) as [number, number];
  return new TZDate(day.getFullYear(), day.getMonth(), day.getDate(), hours, minutes, timeZone);
}

/** The `dayOfMonth` of the month containing `day`, clamped to the month's last day. */
function monthDay(day: TZDate, dayOfMonth: number, time: string, timeZone: string): TZDate {
  const first = new TZDate(day.getFullYear(), day.getMonth(), 1, timeZone);
  const clamped = Math.min(dayOfMonth, getDaysInMonth(first));
  return wallClock(new TZDate(day.getFullYear(), day.getMonth(), clamped, timeZone), time, timeZone);
}

type Frequency = Extract<Schedule, { type: "frequency" }>;
type Interval = Extract<Schedule, { type: "interval" }>;

/** The frequency's slot following `slot`. Monthly slots keep the configured day, clamped per month. */
function nextFrequencySlot(schedule: Frequency, slot: TZDate, timeZone: string): TZDate {
  switch (schedule.every) {
    case "daily":
      return wallClock(addDays(slot, 1), schedule.time, timeZone);
    case "weekly":
      return wallClock(addWeeks(slot, 1), schedule.time, timeZone);
    case "monthly": {
      const nextMonth = addMonths(new TZDate(slot.getFullYear(), slot.getMonth(), 1, timeZone), 1);
      return monthDay(nextMonth, schedule.dayOfMonth, schedule.time, timeZone);
    }
  }
}

/** The frequency's first slot on or after the start of `now`'s period (today, this week, this month). */
function frequencySlotAround(schedule: Frequency, now: TZDate, timeZone: string): TZDate {
  switch (schedule.every) {
    case "daily":
      return wallClock(now, schedule.time, timeZone);
    case "weekly":
      return wallClock(addDays(now, schedule.weekday - getISODay(now)), schedule.time, timeZone);
    case "monthly":
      return monthDay(now, schedule.dayOfMonth, schedule.time, timeZone);
  }
}

function addInterval(schedule: Interval, from: TZDate, times: number): TZDate {
  switch (schedule.unit) {
    case "minutes":
      return addMinutes(from, schedule.amount * times);
    case "hours":
      return addMinutes(from, schedule.amount * 60 * times);
    case "days":
      return addDays(from, schedule.amount * times);
    case "weeks":
      return addWeeks(from, schedule.amount * times);
  }
}

/** Advances `slot` along a recurring schedule until it is later than `now`. */
function firstSlotAfter(schedule: Frequency | Interval, slot: TZDate, now: Date, timeZone: string): TZDate {
  if (schedule.type === "interval" && (schedule.unit === "minutes" || schedule.unit === "hours")) {
    // Fixed-length intervals: jump straight past `now` instead of stepping.
    const step = schedule.amount * (schedule.unit === "hours" ? 3_600_000 : 60_000);
    const elapsed = now.getTime() - slot.getTime();
    return elapsed < 0 ? slot : addInterval(schedule, slot, Math.floor(elapsed / step) + 1);
  }
  let next = slot;
  while (next.getTime() <= now.getTime()) {
    next = schedule.type === "frequency" ? nextFrequencySlot(schedule, next, timeZone) : addInterval(schedule, next, 1);
  }
  return next;
}

/** A plain `Date`, so stored due times are always UTC ISO strings. */
const plain = (date: Date): Date => new Date(date.getTime());

/** The due time of a chore created (or rescheduled) at `now`. */
export function firstDue(schedule: Schedule, now: Date, timeZone: string): Date {
  return plain(firstDueLocal(schedule, now, timeZone));
}

function firstDueLocal(schedule: Schedule, now: Date, timeZone: string): Date {
  const local = new TZDate(now.getTime(), timeZone);
  switch (schedule.type) {
    case "time": {
      const today = wallClock(local, schedule.time, timeZone);
      return today.getTime() > now.getTime() ? today : wallClock(addDays(local, 1), schedule.time, timeZone);
    }
    case "date": {
      const [y, m, d] = schedule.date.split("-").map(Number) as [number, number, number];
      return wallClock(new TZDate(y, m - 1, d, timeZone), schedule.time, timeZone);
    }
    case "timer":
      return addMinutes(now, schedule.minutes);
    case "frequency":
      return firstSlotAfter(schedule, frequencySlotAround(schedule, local, timeZone), now, timeZone);
    case "interval":
      return addInterval(schedule, local, 1);
  }
}

/**
 * The due time of the occurrence following one due at `previousDue`, for a
 * recurring schedule: the next slot on its calendar that is later than `now`.
 */
export function nextDue(schedule: Frequency | Interval, previousDue: Date, now: Date, timeZone: string): Date {
  const previous = new TZDate(previousDue.getTime(), timeZone);
  const following =
    schedule.type === "frequency" ? nextFrequencySlot(schedule, previous, timeZone) : addInterval(schedule, previous, 1);
  return plain(firstSlotAfter(schedule, following, now, timeZone));
}
