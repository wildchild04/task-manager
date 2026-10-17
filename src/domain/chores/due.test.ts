import { describe, expect, it } from "vitest";

import { firstDue, nextDue } from "./due";
import type { Schedule } from "./schedule";
import { scheduleSchema } from "./schedule";

const UTC = "UTC";
const at = (iso: string) => new Date(iso);
const iso = (date: Date) => date.toISOString();

// 2026-10-14 is a Wednesday.
describe("firstDue", () => {
  it("specific time later today", () => {
    expect(iso(firstDue({ type: "time", time: "09:00" }, at("2026-10-14T08:00:00Z"), UTC))).toBe("2026-10-14T09:00:00.000Z");
  });

  it("specific time already passed is tomorrow", () => {
    expect(iso(firstDue({ type: "time", time: "09:00" }, at("2026-10-14T10:00:00Z"), UTC))).toBe("2026-10-15T09:00:00.000Z");
    expect(iso(firstDue({ type: "time", time: "09:00" }, at("2026-10-14T09:00:00Z"), UTC))).toBe("2026-10-15T09:00:00.000Z");
  });

  it("specific date, even in the past", () => {
    expect(iso(firstDue({ type: "date", date: "2026-11-03", time: "14:30" }, at("2026-10-14T10:00:00Z"), UTC))).toBe(
      "2026-11-03T14:30:00.000Z",
    );
    expect(iso(firstDue({ type: "date", date: "2026-01-01", time: "00:00" }, at("2026-10-14T10:00:00Z"), UTC))).toBe(
      "2026-01-01T00:00:00.000Z",
    );
  });

  it("timer", () => {
    expect(iso(firstDue({ type: "timer", minutes: 30 }, at("2026-10-14T10:00:00Z"), UTC))).toBe("2026-10-14T10:30:00.000Z");
  });

  it("daily frequency", () => {
    const daily: Schedule = { type: "frequency", every: "daily", time: "09:00" };
    expect(iso(firstDue(daily, at("2026-10-14T08:00:00Z"), UTC))).toBe("2026-10-14T09:00:00.000Z");
    expect(iso(firstDue(daily, at("2026-10-14T10:00:00Z"), UTC))).toBe("2026-10-15T09:00:00.000Z");
  });

  it("weekly frequency on a Wednesday for Monday is next Monday", () => {
    const weekly: Schedule = { type: "frequency", every: "weekly", weekday: 1, time: "09:00" };
    expect(iso(firstDue(weekly, at("2026-10-14T10:00:00Z"), UTC))).toBe("2026-10-19T09:00:00.000Z");
    // Friday from a Wednesday is this week.
    expect(iso(firstDue({ ...weekly, weekday: 5 }, at("2026-10-14T10:00:00Z"), UTC))).toBe("2026-10-16T09:00:00.000Z");
  });

  it("monthly on the 31st clamps to the month's last day", () => {
    const monthly: Schedule = { type: "frequency", every: "monthly", dayOfMonth: 31, time: "09:00" };
    expect(iso(firstDue(monthly, at("2026-02-10T10:00:00Z"), UTC))).toBe("2026-02-28T09:00:00.000Z");
    expect(iso(firstDue(monthly, at("2026-04-30T10:00:00Z"), UTC))).toBe("2026-05-31T09:00:00.000Z");
  });

  it("every X", () => {
    expect(iso(firstDue({ type: "interval", amount: 6, unit: "hours" }, at("2026-10-14T10:00:00Z"), UTC))).toBe(
      "2026-10-14T16:00:00.000Z",
    );
    expect(iso(firstDue({ type: "interval", amount: 2, unit: "weeks" }, at("2026-10-14T10:00:00Z"), UTC))).toBe(
      "2026-10-28T10:00:00.000Z",
    );
  });

  it("interprets wall-clock times in the workspace time zone", () => {
    // 09:00 in Mexico City (UTC-6) is 15:00 UTC.
    expect(iso(firstDue({ type: "time", time: "09:00" }, at("2026-10-14T12:00:00Z"), "America/Mexico_City"))).toBe(
      "2026-10-14T15:00:00.000Z",
    );
  });
});

describe("nextDue", () => {
  const daily: Schedule & { type: "frequency" } = { type: "frequency", every: "daily", time: "09:00" };

  it("daily chore completed on time is due tomorrow", () => {
    expect(iso(nextDue(daily, at("2026-10-14T09:00:00Z"), at("2026-10-14T09:15:00Z"), UTC))).toBe("2026-10-15T09:00:00.000Z");
  });

  it("skips missed slots", () => {
    // Due Monday the 12th, completed Thursday the 15th at 10:00: next is Friday the 16th.
    expect(iso(nextDue(daily, at("2026-10-12T09:00:00Z"), at("2026-10-15T10:00:00Z"), UTC))).toBe("2026-10-16T09:00:00.000Z");
  });

  it("every 6 hours keeps its rhythm, and skips by arithmetic", () => {
    const every6h = { type: "interval", amount: 6, unit: "hours" } as const;
    expect(iso(nextDue(every6h, at("2026-10-14T12:00:00Z"), at("2026-10-14T12:30:00Z"), UTC))).toBe("2026-10-14T18:00:00.000Z");
    expect(iso(nextDue(every6h, at("2026-10-14T12:00:00Z"), at("2026-10-16T01:00:00Z"), UTC))).toBe("2026-10-16T06:00:00.000Z");
  });

  it("monthly keeps the configured day after a clamped month", () => {
    const monthly = { type: "frequency", every: "monthly", dayOfMonth: 31, time: "09:00" } as const;
    expect(iso(nextDue(monthly, at("2026-02-28T09:00:00Z"), at("2026-02-28T09:30:00Z"), UTC))).toBe("2026-03-31T09:00:00.000Z");
    expect(iso(nextDue(monthly, at("2026-03-31T09:00:00Z"), at("2026-03-31T09:30:00Z"), UTC))).toBe("2026-04-30T09:00:00.000Z");
  });

  it("keeps 09:00 at 09:00 across a daylight-saving change", () => {
    // Berlin leaves summer time on 2026-10-25: 09:00 is 07:00 UTC before and 08:00 UTC after.
    const due = nextDue(daily, at("2026-10-24T07:00:00Z"), at("2026-10-24T07:30:00Z"), "Europe/Berlin");
    expect(iso(due)).toBe("2026-10-25T08:00:00.000Z");
  });

  it("moves a slot that doesn't exist on the spring-forward day forward", () => {
    // 02:30 doesn't exist in Berlin on 2026-03-29; it becomes 03:30 local (01:30 UTC).
    const early = { type: "frequency", every: "daily", time: "02:30" } as const;
    expect(iso(nextDue(early, at("2026-03-28T01:30:00Z"), at("2026-03-28T02:00:00Z"), "Europe/Berlin"))).toBe(
      "2026-03-29T01:30:00.000Z",
    );
  });
});

describe("schedule validation", () => {
  it.each([
    [{ type: "time", time: "25:00" }],
    [{ type: "time", time: "9:00" }],
    [{ type: "date", date: "2026-02-30", time: "09:00" }],
    [{ type: "timer", minutes: 0 }],
    [{ type: "frequency", every: "weekly", time: "09:00" }],
    [{ type: "frequency", every: "monthly", time: "09:00", dayOfMonth: 32 }],
    [{ type: "interval", amount: 1, unit: "months" }],
  ])("rejects %j", (schedule) => {
    expect(scheduleSchema.safeParse(schedule).success).toBe(false);
  });
});
