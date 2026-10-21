import type { AppServices } from "~/composition";
import { choreAttributes, isRecurring, type Schedule } from "~/domain/chores/schedule";
import { kinds } from "~/domain/tasks/kinds";
import type { Actor, LineageNode, TaskSummary } from "~/domain/tasks/types";

import type { MentionTargets, PageView, ViewBlock } from "../blocks/view-model";
import { describeSchedule, formatDateTime, slugOfKind, stateColor, stateLabel, TASK_LISTS } from "./format";
import { type Backlink, pageBacklinks } from "./backlinks.server";
import { targetLink, type TargetLink } from "./links.server";
import { buildBodyView, buildCommentView, mentionTargets } from "./page-view.server";
import { type TransitionForm, transitionStyle } from "./task-actions.server";

export type TransitionView = { name: string; label: string; form: TransitionForm };

export type HistoryEntryView = { id: string; label: string; from: string; to: string; actor: string; note?: string; at: string };

export type CommentView = {
  id: string;
  author: string;
  at: string;
  edited: boolean;
  blocks: ViewBlock[];
  /** What the mentions in the comment show and open. */
  mentions: MentionTargets;
};

export type LineageView = { id: string; label: string; current: boolean; children: LineageView[] };

export type ReferenceView = { relationId: string; target: TargetLink };

export type TaskOverviewView = {
  task: {
    id: string;
    title: string;
    kind: string;
    kindLabel: string;
    state: string;
    stateLabel: string;
    stateColor: ReturnType<typeof stateColor>;
  };
  project: { id: string; title: string; listSlug: string; listTitle: string };
  body: PageView | undefined;
  chore?: {
    urgent: boolean;
    urgency: string;
    schedule?: string;
    due?: string;
    /** Whether urgency and schedule can be changed (the chore is to do). */
    editable: boolean;
    /** The configured schedule as the schedule form's values, to prefill it. */
    scheduleValues: Record<string, string>;
    /** Whether completing may create a following chore, and the default answer. */
    follower: { offered: boolean; default: boolean };
  };
  transitions: TransitionView[];
  /** Done work can start an update. */
  canStartUpdate: boolean;
  history: HistoryEntryView[];
  /** Only work and chores have comments. */
  comments?: CommentView[];
  /** Omitted for chores and for a task alone in its lineage. */
  lineage?: LineageView;
  references: ReferenceView[];
  /** Pages and other tasks that mention or reference this task's description. */
  mentionedIn: Backlink[];
  referencedBy: { id: string; title: string; kindLabel: string }[];
  /** Tasks of the project this task can still reference. */
  referenceCandidates: { id: string; label: string }[];
};

const COMMENTABLE = ["work", "chore"];

/** A comment's content as views, with what its mentions show. */
function commentContent(services: AppServices, bodyBlockId: string) {
  const blocks = buildCommentView(services.blocks, bodyBlockId, services.content);
  return { blocks, mentions: mentionTargets(services.blocks, blocks) };
}

export const actorName = (actor: Actor) => (actor.kind === "human" ? "You" : actor.name);

const kindLabel = (task: TaskSummary) => TASK_LISTS[slugOfKind(task.kind)].singular;

const capitalize = (text: string) => text.charAt(0).toUpperCase() + text.slice(1);

function lineageView(node: LineageNode, currentId: string): LineageView {
  const { task } = node;
  return {
    id: task.id,
    label: `${capitalize(kindLabel(task))} · ${task.title || "Untitled"} · ${stateLabel(task.state)}`,
    current: task.id === currentId,
    children: node.children.map((child) => lineageView(child, currentId)),
  };
}

/** A schedule as the chore form's field values (the inverse of `scheduleFromForm`). */
export function scheduleValues(schedule: Schedule | undefined): Record<string, string> {
  if (!schedule) return { scheduleType: "none" };
  const values: Record<string, string> = { scheduleType: schedule.type };
  for (const [key, value] of Object.entries(schedule)) if (key !== "type") values[key] = String(value);
  return values;
}

function choreView(services: AppServices, task: TaskSummary): TaskOverviewView["chore"] {
  const timeZone = services.tasks.timeZone;
  const { urgency, schedule, dueAt } = choreAttributes(task);
  const todo = task.state === "todo";
  return {
    urgent: services.chores.isUrgent(task),
    urgency,
    ...(schedule ? { schedule: describeSchedule(schedule) } : {}),
    ...(dueAt ? { due: formatDateTime(dueAt, timeZone) } : {}),
    editable: todo,
    scheduleValues: scheduleValues(schedule),
    // A chore due on a specific date can't repeat with the same schedule.
    follower: { offered: schedule?.type !== "date", default: isRecurring(schedule) },
  };
}

export function taskOverviewView(services: AppServices, taskId: string): TaskOverviewView | undefined {
  const task = services.tasks.get(taskId);
  if (!task) return undefined;
  const project = services.projects.get(task.projectId);
  if (!project) return undefined;
  const slug = slugOfKind(task.kind);
  const timeZone = services.tasks.timeZone;

  const transitions = Object.entries(kinds[task.kind].transitions)
    .filter(([, transition]) => transition.from.includes(task.state))
    .map(([name]) => ({ name, ...transitionStyle(task, name) }));

  const history = services.tasks
    .history(task.id)
    .slice()
    .reverse()
    .map((record) => ({
      id: record.id,
      label: transitionStyle(task, record.name).label,
      from: stateLabel(record.fromState),
      to: stateLabel(record.toState),
      actor: actorName(record.actor),
      ...(record.note ? { note: record.note } : {}),
      at: formatDateTime(record.at, timeZone),
    }));

  const comments = COMMENTABLE.includes(task.kind)
    ? services.comments.list(task.id).map((comment) => ({
        id: comment.id,
        author: actorName(comment.author),
        at: formatDateTime(comment.createdAt, timeZone),
        edited: comment.editedAt !== null,
        ...commentContent(services, comment.bodyBlockId),
      }))
    : undefined;

  const lineage = services.tasks.lineage(task.id);
  const references = services.tasks
    .relations(task.id, "references")
    .map((relation) => ({ relationId: relation.id, target: targetLink(services, relation.target) }));
  const referencedIds = new Set(
    services.tasks
      .relations(task.id, "references")
      .filter((r) => r.to.kind === "task")
      .map((r) => r.to.id),
  );
  const referencedBy = services.tasks
    .incoming({ kind: "task", id: task.id }, "references")
    .map((relation) => services.tasks.get(relation.fromTaskId))
    .filter((from): from is TaskSummary => from !== undefined)
    .map((from) => ({ id: from.id, title: from.title || "Untitled", kindLabel: kindLabel(from) }));
  const referenceCandidates = services.tasks
    .list(task.projectId)
    .filter((other) => other.id !== task.id && !referencedIds.has(other.id))
    .map((other) => ({ id: other.id, label: `${capitalize(kindLabel(other))}: ${other.title || "Untitled"}` }));

  return {
    task: {
      id: task.id,
      title: task.title || "Untitled",
      kind: task.kind,
      kindLabel: kindLabel(task),
      state: task.state,
      stateLabel: stateLabel(task.state),
      stateColor: stateColor(task.state),
    },
    project: { id: project.id, title: project.title || "Untitled", listSlug: slug, listTitle: TASK_LISTS[slug].title },
    body: buildBodyView(services.blocks, task.bodyPageId, services.suggestions, services.content),
    ...(task.kind === "chore" ? { chore: choreView(services, task) } : {}),
    transitions,
    canStartUpdate: task.kind === "work" && task.state === "done",
    history,
    ...(comments ? { comments } : {}),
    ...(lineage && lineage.children.length > 0 ? { lineage: lineageView(lineage, task.id) } : {}),
    references,
    mentionedIn: pageBacklinks(services, task.bodyPageId),
    referencedBy,
    referenceCandidates,
  };
}
