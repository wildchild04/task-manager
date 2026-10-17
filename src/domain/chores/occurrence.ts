import { plainText } from "../blocks/text";
import { TaskError } from "../tasks/errors";
import type { EffectContext, InitializeContext } from "../tasks/kinds/kind-definition";
import { firstDue, nextDue } from "./due";
import type { ChoreAttributes } from "./schedule";
import { choreAttributes } from "./schedule";

/** Fills in a new chore's derived attributes: its base urgency, series and due time. */
export function initializeChore(attributes: Record<string, unknown>, { id, now, timeZone }: InitializeContext) {
  const { schedule, urgency } = choreAttributes({ id, attributes });
  const derived: ChoreAttributes = { urgency, baseUrgency: urgency, seriesId: id };
  if (schedule) {
    derived.schedule = schedule;
    derived.dueAt = firstDue(schedule, now, timeZone).toISOString();
  }
  return derived;
}

/**
 * Creates the chore following `context.task` with the same configuration:
 * base urgency, schedule, series, title and a copy of the body page.
 */
export function createNextOccurrence(context: EffectContext<unknown>): void {
  const { task, at, timeZone, repositories } = context;
  const attributes = choreAttributes(task);
  const { schedule } = attributes;
  const now = new Date(at);

  let dueAt: string | undefined;
  if (schedule?.type === "date") {
    throw new TaskError("validation", "A chore due on a specific date can't repeat with the same schedule");
  } else if (schedule?.type === "time" || schedule?.type === "timer") {
    dueAt = firstDue(schedule, now, timeZone).toISOString();
  } else if (schedule) {
    dueAt = nextDue(schedule, attributes.dueAt ? new Date(attributes.dueAt) : now, now, timeZone).toISOString();
  }

  const next: ChoreAttributes = {
    urgency: attributes.baseUrgency,
    baseUrgency: attributes.baseUrgency,
    seriesId: attributes.seriesId,
    ...(schedule ? { schedule } : {}),
    ...(dueAt ? { dueAt } : {}),
  };
  const page = repositories.blocks.getBlock(task.bodyPageId);
  const id = context.newId();
  context.createTask({ id, projectId: task.projectId, kind: "chore", title: page ? plainText(page.content) : "", attributes: next });
  context.copyBody(task.id, id);
}
