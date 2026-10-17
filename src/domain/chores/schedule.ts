import { z } from "zod";

const time = z.string().regex(/^([01]\d|2[0-3]):[0-5]\d$/, "Times are HH:MM between 00:00 and 23:59");

const date = z
  .string()
  .regex(/^\d{4}-\d{2}-\d{2}$/, "Dates are YYYY-MM-DD")
  .refine((value) => {
    const [y, m, d] = value.split("-").map(Number) as [number, number, number];
    const check = new Date(Date.UTC(y, m - 1, d));
    return check.getUTCFullYear() === y && check.getUTCMonth() === m - 1 && check.getUTCDate() === d;
  }, "Not a calendar date");

export const scheduleSchema = z.discriminatedUnion("type", [
  /** One-off: the next time the clock shows `time`. */
  z.object({ type: z.literal("time"), time }).strict(),
  /** One-off: a date and a time. */
  z.object({ type: z.literal("date"), date, time }).strict(),
  /** One-off: `minutes` from when the chore is created. */
  z.object({ type: z.literal("timer"), minutes: z.number().int().min(1) }).strict(),
  /** Recurring: daily, weekly (on `weekday`, 1 = Monday) or monthly (on `dayOfMonth`) at `time`. */
  z.discriminatedUnion("every", [
    z.object({ type: z.literal("frequency"), every: z.literal("daily"), time }).strict(),
    z.object({ type: z.literal("frequency"), every: z.literal("weekly"), time, weekday: z.number().int().min(1).max(7) }).strict(),
    z
      .object({ type: z.literal("frequency"), every: z.literal("monthly"), time, dayOfMonth: z.number().int().min(1).max(31) })
      .strict(),
  ]),
  /** Recurring: a fixed interval, for cron-like jobs. */
  z
    .object({
      type: z.literal("interval"),
      amount: z.number().int().min(1),
      unit: z.enum(["minutes", "hours", "days", "weeks"]),
    })
    .strict(),
]);

export type Schedule = z.infer<typeof scheduleSchema>;

export const urgencySchema = z.enum(["normal", "urgent"]);
export type Urgency = z.infer<typeof urgencySchema>;

/** Chore attributes as stored. Derived fields (`baseUrgency`, `dueAt`, `seriesId`) are filled in at creation. */
export const choreAttributesSchema = z
  .object({
    urgency: urgencySchema.default("normal"),
    baseUrgency: urgencySchema.optional(),
    schedule: scheduleSchema.optional(),
    dueAt: z.iso.datetime({ offset: true }).optional(),
    seriesId: z.string().min(1).optional(),
  })
  .strict();

export type ChoreAttributes = {
  urgency: Urgency;
  baseUrgency: Urgency;
  schedule?: Schedule;
  dueAt?: string;
  seriesId: string;
};

export function isRecurring(schedule: Schedule | undefined): boolean {
  return schedule?.type === "frequency" || schedule?.type === "interval";
}

/** A chore's attributes with defaults applied, including chores stored before this change. */
export function choreAttributes(task: { id: string; attributes: Record<string, unknown> }): ChoreAttributes {
  const a = task.attributes as Partial<ChoreAttributes>;
  const urgency = a.urgency ?? "normal";
  return {
    urgency,
    baseUrgency: a.baseUrgency ?? urgency,
    ...(a.schedule ? { schedule: a.schedule } : {}),
    ...(a.dueAt ? { dueAt: a.dueAt } : {}),
    seriesId: a.seriesId ?? task.id,
  };
}
