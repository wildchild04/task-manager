import type { AppServices } from "~/composition";
import type { Schedule } from "~/domain/chores/schedule";
import { scheduleSchema, urgencySchema } from "~/domain/chores/schedule";
import { byRecency, orderChores } from "~/domain/projects/dashboard";
import type { TaskKind, TaskSummary } from "~/domain/tasks/types";

import { formatDateTime, stateColor, stateLabel, TASK_LISTS, type TaskListSlug } from "./format";
import { type ActionResult, domainError, type FieldErrors, formValues, invalid } from "./forms.server";

type Filter = { value: string; label: string; states: readonly string[] | "all" };

const FILTERS: Record<TaskKind, readonly Filter[]> = {
  exploration: [
    { value: "open", label: "Open", states: ["open"] },
    { value: "tombstoned", label: "Tombstoned", states: ["tombstoned"] },
    { value: "promoted", label: "Promoted", states: ["promoted"] },
    { value: "all", label: "All", states: "all" },
  ],
  update: [
    { value: "open", label: "Open", states: ["open"] },
    { value: "tombstoned", label: "Tombstoned", states: ["tombstoned"] },
    { value: "promoted", label: "Promoted", states: ["promoted"] },
    { value: "all", label: "All", states: "all" },
  ],
  work: [
    { value: "active", label: "Active", states: ["todo", "in_progress"] },
    { value: "done", label: "Done", states: ["done"] },
    { value: "cancelled", label: "Cancelled", states: ["cancelled"] },
    { value: "all", label: "All", states: "all" },
  ],
  chore: [
    { value: "todo", label: "To do", states: ["todo"] },
    { value: "done", label: "Done", states: ["done"] },
    { value: "cancelled", label: "Cancelled", states: ["cancelled"] },
    { value: "all", label: "All", states: "all" },
  ],
};

export type TaskRowView = {
  id: string;
  title: string;
  state: string;
  stateLabel: string;
  stateColor: ReturnType<typeof stateColor>;
  updated: string;
  urgent?: boolean;
  due?: string;
};

export type TaskListView = {
  project: { id: string; title: string };
  list: { slug: TaskListSlug; title: string; singular: string; kind: TaskKind };
  filters: { value: string; label: string }[];
  filter: string;
  rows: TaskRowView[];
  /** For the update dialog: the project's done work an update can iterate on. */
  doneWork: { id: string; title: string }[];
};

export function taskListView(
  services: AppServices,
  projectId: string,
  slug: TaskListSlug,
  filterParam: string | null,
): TaskListView | undefined {
  const project = services.projects.get(projectId);
  if (!project) return undefined;
  const list = TASK_LISTS[slug];
  const filters = FILTERS[list.kind];
  const filter = filters.find((f) => f.value === filterParam) ?? filters[0]!;
  const timeZone = services.tasks.timeZone;

  const tasks = services.tasks
    .list(projectId, { kind: list.kind })
    .filter((task) => filter.states === "all" || filter.states.includes(task.state));
  const row = (task: TaskSummary, extra: Partial<TaskRowView> = {}): TaskRowView => ({
    id: task.id,
    title: task.title || "Untitled",
    state: task.state,
    stateLabel: stateLabel(task.state),
    stateColor: stateColor(task.state),
    updated: formatDateTime(task.updatedAt, timeZone),
    ...extra,
  });
  const rows =
    list.kind === "chore"
      ? orderChores(tasks, services.chores).map(({ task, urgent, dueAt }) =>
          row(task, { urgent, ...(dueAt ? { due: formatDateTime(dueAt, timeZone) } : {}) }),
        )
      : byRecency(tasks).map((task) => row(task));

  return {
    project: { id: project.id, title: project.title || "Untitled" },
    list: { slug, ...list },
    filters: filters.map(({ value, label }) => ({ value, label })),
    filter: filter.value,
    rows,
    doneWork:
      list.kind === "update"
        ? services.tasks.list(projectId, { kind: "work", state: "done" }).map((w) => ({ id: w.id, title: w.title || "Untitled" }))
        : [],
  };
}

const toNumber = (value: string | undefined) => (value ? Number(value) : undefined);

/** Builds a schedule from the chore form's fields, or field errors named like the schedule's fields. */
export function scheduleFromForm(values: Record<string, string>): { schedule?: Schedule; errors: FieldErrors } {
  const type = values.scheduleType;
  if (!type || type === "none") return { errors: {} };
  const candidate: Record<string, unknown> = { type };
  if (type === "time" || type === "date" || type === "frequency") candidate.time = values.time;
  if (type === "date") candidate.date = values.date;
  if (type === "timer") candidate.minutes = toNumber(values.minutes);
  if (type === "frequency") {
    candidate.every = values.every;
    if (values.every === "weekly") candidate.weekday = toNumber(values.weekday);
    if (values.every === "monthly") candidate.dayOfMonth = toNumber(values.dayOfMonth);
  }
  if (type === "interval") {
    candidate.amount = toNumber(values.amount);
    candidate.unit = values.unit;
  }

  const parsed = scheduleSchema.safeParse(candidate);
  if (parsed.success) return { schedule: parsed.data, errors: {} };
  const errors: FieldErrors = {};
  for (const issue of parsed.error.issues) {
    const field = typeof issue.path[0] === "string" && issue.path[0] !== "type" ? issue.path[0] : "scheduleType";
    errors[field] ??= field === "time" ? "Choose a time" : issue.message;
  }
  return { errors };
}

/** Creates a task of the list's kind from its form. */
export function createTaskAction(
  services: AppServices,
  projectId: string,
  slug: TaskListSlug,
  formData: FormData,
): ActionResult {
  const values = formValues(formData);
  const { kind } = TASK_LISTS[slug];
  const errors: FieldErrors = {};
  if (!values.title) errors.title = "A title is required";

  const input: Parameters<AppServices["tasks"]["create"]>[0] = {
    id: crypto.randomUUID(),
    projectId,
    kind,
    title: values.title ?? "",
  };
  if (kind === "update") {
    if (!values.iteratesOn) errors.iteratesOn = "Choose the done work this update iterates on";
    input.iteratesOn = values.iteratesOn;
  }
  if (kind === "chore") {
    const urgency = urgencySchema.safeParse(values.urgency || "normal");
    if (!urgency.success) errors.urgency = "Choose normal or urgent";
    const { schedule, errors: scheduleErrors } = scheduleFromForm(values);
    Object.assign(errors, scheduleErrors);
    input.attributes = { urgency: urgency.data ?? "normal", ...(schedule ? { schedule } : {}) };
  }
  if (Object.keys(errors).length > 0) return invalid(values, errors);

  try {
    return { ok: true, id: services.tasks.create(input).id };
  } catch (error) {
    return domainError(error, values, kind === "update" ? "iteratesOn" : "title");
  }
}

