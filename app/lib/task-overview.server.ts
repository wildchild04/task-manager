import type { AppServices } from "~/composition";
import { choreAttributes } from "~/domain/chores/schedule";

import type { PageView } from "../blocks/view-model";
import { describeSchedule, formatDateTime, slugOfKind, stateColor, stateLabel, TASK_LISTS } from "./format";
import { buildBodyView } from "./page-view.server";

export type TaskOverviewView = {
  task: {
    id: string;
    title: string;
    kindLabel: string;
    state: string;
    stateLabel: string;
    stateColor: ReturnType<typeof stateColor>;
  };
  project: { id: string; title: string; listSlug: string; listTitle: string };
  body: PageView | undefined;
  chore?: { urgent: boolean; urgency: string; schedule?: string; due?: string };
};

export function taskOverviewView(services: AppServices, taskId: string): TaskOverviewView | undefined {
  const task = services.tasks.get(taskId);
  if (!task) return undefined;
  const project = services.projects.get(task.projectId);
  if (!project) return undefined;
  const slug = slugOfKind(task.kind);
  const timeZone = services.tasks.timeZone;

  let chore: TaskOverviewView["chore"];
  if (task.kind === "chore") {
    const { urgency, schedule, dueAt } = choreAttributes(task);
    chore = {
      urgent: services.chores.isUrgent(task),
      urgency,
      ...(schedule ? { schedule: describeSchedule(schedule) } : {}),
      ...(dueAt ? { due: formatDateTime(dueAt, timeZone) } : {}),
    };
  }

  return {
    task: {
      id: task.id,
      title: task.title || "Untitled",
      kindLabel: TASK_LISTS[slug].singular,
      state: task.state,
      stateLabel: stateLabel(task.state),
      stateColor: stateColor(task.state),
    },
    project: { id: project.id, title: project.title || "Untitled", listSlug: slug, listTitle: TASK_LISTS[slug].title },
    body: buildBodyView(services.blocks, task.bodyPageId),
    ...(chore ? { chore } : {}),
  };
}
