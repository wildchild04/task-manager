import { z } from "zod";

import { TaskError } from "../errors";
import type { TaskKind } from "../types";
import type { EffectContext, KindDefinition } from "./kind-definition";
import { defineKind } from "./kind-definition";

/** Kinds without attributes yet accept only an empty attribute set. */
const noAttributes = z.object({}).strict();

const promoteInput = z.object({ workId: z.string().min(1), title: z.string() }).strict();
type PromoteInput = z.infer<typeof promoteInput>;

/** Promotion creates exactly one work task in the same project, born from the promoted task. */
function promote({ task, input, at, repositories, createTask }: EffectContext<PromoteInput>) {
  const work = createTask({ id: input.workId, projectId: task.projectId, kind: "work", title: input.title });
  repositories.tasks.insertRelation({
    id: crypto.randomUUID(),
    type: "born_from",
    fromTaskId: work.id,
    to: { kind: "task", id: task.id },
    createdAt: at,
  });
}

/** Explorations and updates share a lifecycle: open, then promoted or tombstoned (and revivable). */
const ideaLifecycle = {
  states: ["open", "promoted", "tombstoned"],
  initial: "open",
  terminal: ["promoted"],
  transitions: {
    promote: { from: ["open"], to: "promoted", input: promoteInput, effect: promote },
    tombstone: { from: ["open"], to: "tombstoned" },
    revive: { from: ["tombstoned"], to: "open" },
  },
  attributes: noAttributes,
} as const;

export const exploration = defineKind({ kind: "exploration", ...ideaLifecycle });
export const update = defineKind({ kind: "update", ...ideaLifecycle });

const returnInput = z
  .object({
    reason: z.string().trim().min(1, "A return needs a reason"),
    /** Block operations on the task's body page, applied with the return. */
    bodyBatch: z.array(z.any()).optional(),
  })
  .strict();

export const work = defineKind({
  kind: "work",
  states: ["todo", "in_progress", "done", "cancelled"],
  initial: "todo",
  terminal: ["done"],
  transitions: {
    start: { from: ["todo"], to: "in_progress" },
    pause: { from: ["in_progress"], to: "todo" },
    // The body update is applied by the task service, which checks it stays inside the body page.
    return: { from: ["in_progress"], to: "todo", input: returnInput, note: (input: z.infer<typeof returnInput>) => input.reason },
    complete: { from: ["in_progress"], to: "done" },
    cancel: { from: ["todo", "in_progress"], to: "cancelled" },
    reopen: { from: ["cancelled"], to: "todo" },
  },
  attributes: noAttributes,
});

const cancelChoreInput = z.object({ scope: z.enum(["occurrence", "series"]) }).strict();

export const chore = defineKind({
  kind: "chore",
  states: ["todo", "done", "cancelled"],
  initial: "todo",
  terminal: ["done", "cancelled"],
  transitions: {
    complete: { from: ["todo"], to: "done" },
    cancel: {
      from: ["todo"],
      to: "cancelled",
      input: cancelChoreInput,
      // Schedules come with the chore change; until then no chore has one.
      effect: ({ task, input }: EffectContext<z.infer<typeof cancelChoreInput>>) => {
        if (input.scope === "series" && !task.attributes.schedule) {
          throw new TaskError("validation", "Only a scheduled chore can cancel its series");
        }
      },
    },
  },
  attributes: noAttributes,
});

export const kinds: Readonly<Record<TaskKind, KindDefinition>> = { exploration, update, work, chore };
