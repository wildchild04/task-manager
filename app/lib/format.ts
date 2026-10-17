import type { ChipProps } from "@wildchild/design-system";

import type { Schedule } from "~/domain/chores/schedule";
import type { TaskKind } from "~/domain/tasks/types";

/** "17 Oct 2026, 09:00" in the given time zone (24-hour clock). */
export function formatDateTime(iso: string, timeZone: string): string {
  return new Intl.DateTimeFormat("en-GB", { dateStyle: "medium", timeStyle: "short", hourCycle: "h23", timeZone }).format(
    new Date(iso),
  );
}

const WEEKDAYS = ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday", "Sunday"];

function formatDate(date: string): string {
  const [y, m, d] = date.split("-").map(Number) as [number, number, number];
  return new Intl.DateTimeFormat("en-GB", { dateStyle: "medium", timeZone: "UTC" }).format(new Date(Date.UTC(y, m - 1, d)));
}

const plural = (amount: number, unit: string) => (amount === 1 ? unit : `${amount} ${unit}s`);

function describeFrequency(schedule: Extract<Schedule, { type: "frequency" }>): string {
  switch (schedule.every) {
    case "daily":
      return `Every day at ${schedule.time}`;
    case "weekly":
      return `Every ${WEEKDAYS[schedule.weekday - 1]} at ${schedule.time}`;
    case "monthly":
      return `Every month on day ${schedule.dayOfMonth} at ${schedule.time}`;
  }
}

/** A schedule in words: "Every Monday at 09:00", "Every 6 hours", "On 3 Nov 2026 at 14:30". */
export function describeSchedule(schedule: Schedule): string {
  switch (schedule.type) {
    case "time":
      return `At ${schedule.time}`;
    case "date":
      return `On ${formatDate(schedule.date)} at ${schedule.time}`;
    case "timer":
      return `${plural(schedule.minutes, "minute")} after it was set`;
    case "frequency":
      return describeFrequency(schedule);
    case "interval":
      return `Every ${plural(schedule.amount, schedule.unit.slice(0, -1))}`;
  }
}

const STATE_LABELS: Record<string, string> = {
  open: "Open",
  promoted: "Promoted",
  tombstoned: "Tombstoned",
  todo: "To do",
  in_progress: "In progress",
  done: "Done",
  cancelled: "Cancelled",
};

export const stateLabel = (state: string) => STATE_LABELS[state] ?? state;

type ChipColor = NonNullable<ChipProps["color"]>;

const STATE_COLORS: Record<string, ChipColor> = {
  open: "info",
  in_progress: "primary",
  promoted: "success",
  done: "success",
  tombstoned: "secondary",
  cancelled: "secondary",
  todo: "tertiary",
};

export const stateColor = (state: string): ChipColor => STATE_COLORS[state] ?? "secondary";

/** The four task lists, by URL slug. */
export const TASK_LISTS = {
  explorations: { kind: "exploration", title: "Explorations", singular: "exploration" },
  updates: { kind: "update", title: "Updates", singular: "update" },
  work: { kind: "work", title: "Work", singular: "work" },
  chores: { kind: "chore", title: "Chores", singular: "chore" },
} as const satisfies Record<string, { kind: TaskKind; title: string; singular: string }>;

export type TaskListSlug = keyof typeof TASK_LISTS;

export const isTaskListSlug = (value: string | undefined): value is TaskListSlug =>
  value !== undefined && value in TASK_LISTS;

export const slugOfKind = (kind: TaskKind): TaskListSlug =>
  (Object.keys(TASK_LISTS) as TaskListSlug[]).find((slug) => TASK_LISTS[slug].kind === kind)!;
