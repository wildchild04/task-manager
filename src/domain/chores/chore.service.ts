import { TaskError } from "../tasks/errors";
import type { TaskService } from "../tasks/task.service";
import type { Task, TaskSummary } from "../tasks/types";
import type { UnitOfWork } from "../unit-of-work";
import { firstDue } from "./due";
import type { ChoreAttributes, Schedule, Urgency } from "./schedule";
import { choreAttributes, scheduleSchema, urgencySchema } from "./schedule";

const fail = (code: TaskError["code"], message: string): never => {
  throw new TaskError(code, message);
};

export class ChoreService {
  constructor(
    private readonly uow: UnitOfWork,
    private readonly tasks: TaskService,
    private readonly now: () => string = () => new Date().toISOString(),
  ) {}

  /** A chore's attributes with defaults applied. */
  attributes(taskId: string): ChoreAttributes | undefined {
    const task = this.uow.repositories.tasks.get(taskId);
    return task?.kind === "chore" ? choreAttributes(task) : undefined;
  }

  /** Urgent when marked urgent, or when in `todo` and past its due time. Computed, never stored. */
  isUrgent(task: Task, now = this.now()): boolean {
    const { urgency, dueAt } = choreAttributes(task);
    if (urgency === "urgent") return true;
    return task.state === "todo" && dueAt !== undefined && Date.parse(dueAt) <= Date.parse(now);
  }

  /** Sets this occurrence's urgency (e.g. promotes it to urgent). The configuration is unchanged. */
  setUrgency(taskId: string, urgency: Urgency): TaskSummary {
    const parsed = urgencySchema.safeParse(urgency);
    if (!parsed.success) fail("validation", `Unknown urgency: ${String(urgency)}`);
    return this.change(taskId, (attributes) => ({ ...attributes, urgency: parsed.data! }));
  }

  /** Changes the configured schedule (carried to later occurrences) and recomputes the due time from now. */
  setSchedule(taskId: string, schedule: Schedule | null): TaskSummary {
    if (schedule === null) {
      return this.change(taskId, ({ schedule: _schedule, dueAt: _dueAt, ...rest }) => rest);
    }
    const parsed = scheduleSchema.safeParse(schedule);
    if (!parsed.success) fail("validation", parsed.error.issues[0]?.message ?? "Invalid schedule");
    const dueAt = firstDue(parsed.data!, new Date(this.now()), this.tasks.timeZone).toISOString();
    return this.change(taskId, (attributes) => ({ ...attributes, schedule: parsed.data!, dueAt }));
  }

  /** The chores of a series, oldest first. */
  series(seriesId: string): TaskSummary[] {
    const first = this.tasks.get(seriesId);
    if (!first || first.kind !== "chore") return [];
    return this.tasks
      .list(first.projectId, { kind: "chore" })
      .filter((task) => choreAttributes(task).seriesId === seriesId);
  }

  private change(taskId: string, update: (attributes: ChoreAttributes) => ChoreAttributes): TaskSummary {
    this.uow.run((repos) => {
      const task = repos.tasks.get(taskId) ?? fail("not_found", `Task ${taskId} does not exist`);
      if (task.kind !== "chore") fail("validation", `Task ${taskId} is not a chore`);
      if (task.state !== "todo") fail("invalid_transition", `A ${task.state} chore can't be changed`);
      repos.tasks.updateAttributes(taskId, update(choreAttributes(task)), this.now());
    });
    return this.tasks.get(taskId)!;
  }
}
