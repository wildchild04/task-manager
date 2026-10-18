import { z } from "zod";

import type { AppServices } from "~/composition";
import { richTextSchema } from "~/domain/blocks/schema";
import { type Batch, isTextType } from "~/domain/blocks/types";
import type { CommentBlockInput } from "~/domain/comments/types";
import { choreAttributes, isRecurring, urgencySchema } from "~/domain/chores/schedule";
import type { TaskKind, TaskSummary } from "~/domain/tasks/types";

import { type ActionResult, domainError, formValues, invalid } from "./forms.server";
import { paragraphsFromText } from "./text.server";

/** How the task page asks for a transition's input. */
export type TransitionForm = "direct" | "promote" | "return" | "complete-chore" | "cancel-chore";

type TransitionStyle = { label: string; form: TransitionForm };

/** Labels and forms per kind and transition. Anything missing shows as a direct button named after the transition. */
const TRANSITIONS: Partial<Record<TaskKind, Record<string, TransitionStyle>>> = {
  exploration: {
    promote: { label: "Promote to work", form: "promote" },
    tombstone: { label: "Tombstone", form: "direct" },
    revive: { label: "Revive", form: "direct" },
  },
  update: {
    promote: { label: "Promote to work", form: "promote" },
    tombstone: { label: "Tombstone", form: "direct" },
    revive: { label: "Revive", form: "direct" },
  },
  work: {
    start: { label: "Start", form: "direct" },
    pause: { label: "Pause", form: "direct" },
    return: { label: "Return", form: "return" },
    complete: { label: "Complete", form: "direct" },
    cancel: { label: "Cancel", form: "direct" },
    reopen: { label: "Reopen", form: "direct" },
  },
  chore: {
    complete: { label: "Complete", form: "complete-chore" },
    cancel: { label: "Cancel", form: "cancel-chore" },
  },
};

const capitalize = (name: string) => name.charAt(0).toUpperCase() + name.slice(1);

/** The label and form for a transition; a repeating chore's cancel asks for the scope, any other cancels directly. */
export function transitionStyle(task: TaskSummary, name: string): TransitionStyle {
  const style = TRANSITIONS[task.kind]?.[name] ?? { label: capitalize(name), form: "direct" };
  if (style.form === "cancel-chore" && !isRecurring(choreAttributes(task).schedule)) return { ...style, form: "direct" };
  return style;
}

const success = (id: string, redirectTo?: string): ActionResult => ({ ok: true, id, ...(redirectTo ? { redirectTo } : {}) });

/** The input a transition gets from its form; `undefined` for transitions without input. */
function transitionInput(services: AppServices, task: TaskSummary, name: string, values: Record<string, string>) {
  if (name === "promote") return { workId: crypto.randomUUID(), title: values.title ?? "" };
  if (task.kind === "work" && name === "return") {
    const blocks = paragraphsFromText(values.description ?? "");
    let afterId = services.blocks.getChildren(task.bodyPageId).at(-1)?.id ?? null;
    const bodyBatch: Batch = blocks.map((block) => {
      const op = { op: "insert" as const, block, parentId: task.bodyPageId, afterId };
      afterId = block.id;
      return op;
    });
    return { reason: values.reason ?? "", ...(bodyBatch.length > 0 ? { bodyBatch } : {}) };
  }
  if (task.kind === "chore" && name === "complete") return { next: values.next === "yes" };
  if (task.kind === "chore" && name === "cancel") return { scope: values.scope === "series" ? "series" : "occurrence" };
  return undefined;
}

function applyTransition(services: AppServices, task: TaskSummary, values: Record<string, string>): ActionResult {
  const name = values.transition ?? "";
  if (name === "promote" && !values.title) return invalid(values, { title: "A title is required" });
  if (name === "return" && task.kind === "work" && !values.reason) return invalid(values, { reason: "A return needs a reason" });

  const input = transitionInput(services, task, name, values);
  try {
    services.tasks.transition(task.id, name, input === undefined ? {} : { input });
  } catch (error) {
    return domainError(error, values, name === "return" ? "reason" : name === "promote" ? "title" : null);
  }
  if (name === "promote") {
    const work = input as { workId: string };
    return success(work.workId, `/tasks/${work.workId}`);
  }
  return success(task.id);
}

function setUrgency(services: AppServices, task: TaskSummary, values: Record<string, string>): ActionResult {
  const urgency = urgencySchema.safeParse(values.urgency);
  if (!urgency.success) return invalid(values, {}, "Choose normal or urgent");
  try {
    services.chores.setUrgency(task.id, urgency.data);
    return success(task.id);
  } catch (error) {
    return domainError(error, values, null);
  }
}

/** The blocks of a comment written in the editor, as posted (JSON). */
const commentBlocksSchema: z.ZodType<CommentBlockInput[]> = z.array(
  z.lazy(() =>
    z
      .object({
        id: z.string().min(1),
        type: z.string(),
        props: z.record(z.string(), z.unknown()).optional(),
        content: richTextSchema.optional(),
        children: commentBlocksSchema.optional(),
      })
      .strict(),
  ),
) as unknown as z.ZodType<CommentBlockInput[]>;

/** Whether a comment has nothing in it: only text blocks without text and without children. */
function isEmptyComment(blocks: readonly CommentBlockInput[]): boolean {
  return blocks.every(
    (block) =>
      isTextType(block.type) && (block.content ?? []).every((span) => span.text.trim() === "") && !block.children?.length,
  );
}

function addComment(services: AppServices, task: TaskSummary, values: Record<string, string>): ActionResult {
  let raw: unknown;
  try {
    raw = JSON.parse(values.blocks ?? "[]");
  } catch {
    return invalid(values, {}, "The comment couldn't be read");
  }
  const parsed = commentBlocksSchema.safeParse(raw);
  if (!parsed.success) return invalid(values, {}, "The comment couldn't be read");
  if (isEmptyComment(parsed.data)) return invalid(values, { text: "The comment is empty" });
  try {
    return success(services.comments.add({ id: crypto.randomUUID(), taskId: task.id, blocks: parsed.data }).id);
  } catch (error) {
    return domainError(error, values, "text");
  }
}

/** The comment named in the form, if it belongs to this task. */
function commentOf(services: AppServices, task: TaskSummary, values: Record<string, string>) {
  const comment = values.commentId ? services.comments.get(values.commentId) : undefined;
  return comment?.taskId === task.id ? comment : undefined;
}

function deleteComment(services: AppServices, task: TaskSummary, values: Record<string, string>): ActionResult {
  const comment = commentOf(services, task, values);
  if (!comment) return invalid(values, {}, "This comment no longer exists");
  services.comments.delete(comment.id);
  return success(comment.id);
}

function addReference(services: AppServices, task: TaskSummary, values: Record<string, string>): ActionResult {
  const target = values.targetId ? services.tasks.get(values.targetId) : undefined;
  if (!target || target.projectId !== task.projectId) return invalid(values, { targetId: "Choose a task of this project" });
  try {
    return success(services.tasks.addReference(task.id, { kind: "task", id: target.id }).id);
  } catch (error) {
    return domainError(error, values, "targetId");
  }
}

function removeReference(services: AppServices, task: TaskSummary, values: Record<string, string>): ActionResult {
  const relation = services.tasks.relations(task.id, "references").find((r) => r.id === values.relationId);
  if (!relation) return invalid(values, {}, "This reference no longer exists");
  try {
    services.tasks.removeRelation(relation.id);
    return success(task.id);
  } catch (error) {
    return domainError(error, values, null);
  }
}

/** Creates an open exploration referencing this task, or one of its comments. */
function startExploration(services: AppServices, task: TaskSummary, values: Record<string, string>): ActionResult {
  if (!values.title) return invalid(values, { title: "A title is required" });
  let reference = { kind: "task", id: task.id };
  if (values.commentId) {
    const comment = commentOf(services, task, values);
    if (!comment) return invalid(values, {}, "This comment no longer exists");
    reference = { kind: "comment", id: comment.id };
  }
  try {
    const exploration = services.tasks.create({
      id: crypto.randomUUID(),
      projectId: task.projectId,
      kind: "exploration",
      title: values.title,
      references: [reference],
    });
    return success(exploration.id, `/tasks/${exploration.id}`);
  } catch (error) {
    return domainError(error, values);
  }
}

/** Creates an open update iterating on this done work. */
function startUpdate(services: AppServices, task: TaskSummary, values: Record<string, string>): ActionResult {
  if (!values.title) return invalid(values, { title: "A title is required" });
  try {
    const update = services.tasks.create({
      id: crypto.randomUUID(),
      projectId: task.projectId,
      kind: "update",
      title: values.title,
      iteratesOn: task.id,
    });
    return success(update.id, `/tasks/${update.id}`);
  } catch (error) {
    return domainError(error, values);
  }
}

const HANDLERS = {
  transition: applyTransition,
  urgency: setUrgency,
  "comment-add": addComment,
  "comment-delete": deleteComment,
  "reference-add": addReference,
  "reference-remove": removeReference,
  "start-exploration": startExploration,
  "start-update": startUpdate,
} satisfies Record<string, (services: AppServices, task: TaskSummary, values: Record<string, string>) => ActionResult>;

export type TaskIntent = keyof typeof HANDLERS;

const isIntent = (value: string | undefined): value is TaskIntent => value !== undefined && value in HANDLERS;

/**
 * Handles a form posted from the task page, chosen by its `intent`. An
 * unknown task or intent comes back as a status for the route to answer.
 */
export function taskAction(
  services: AppServices,
  taskId: string,
  formData: FormData,
): { status: "not_found" | "bad_request" } | ActionResult {
  const task = services.tasks.get(taskId);
  if (!task) return { status: "not_found" };
  const values = formValues(formData);
  if (!isIntent(values.intent)) return { status: "bad_request" };
  return HANDLERS[values.intent](services, task, values);
}
