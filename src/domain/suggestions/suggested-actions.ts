import type { BlockService } from "../blocks/block.service";
import { BatchError } from "../blocks/errors";
import { plainText } from "../blocks/text";
import type { ChoreService } from "../chores/chore.service";
import { choreAttributes, isRecurring, scheduleSchema } from "../chores/schedule";
import { PROJECT_OWNER_KIND } from "../projects/types";
import type { ProjectService } from "../projects/project.service";
import { kinds } from "../tasks/kinds";
import type { TaskService } from "../tasks/task.service";
import { HUMAN } from "../tasks/types";
import { SuggestionError } from "./errors";
import type { ActionPayload, Subject } from "./types";

/**
 * What action suggestions act on, as the suggestion service sees it: where a
 * subject shows, whether an action can be applied to it now, what the action
 * depends on, and applying it through the owning domain.
 */
export interface SuggestedActions {
  /** The subject's place page (a project's home page, the page, a task's body page), or `undefined` when it doesn't exist. */
  placeOf(subject: Subject): string | undefined;
  /** Refuses, with a `validation` error, an action that can't be applied to the subject now. */
  check(subject: Subject, payload: ActionPayload): void;
  /** What the action depends on now, as a string to compare; `undefined` when the subject is gone. */
  baseOf(subject: Subject, payload: ActionPayload): string | undefined;
  /** Applies the action as the human. */
  run(subject: Subject, payload: ActionPayload): void;
}

const fail = (message: string): never => {
  throw new SuggestionError("validation", message);
};

/** The ending transition each kind can have suggested, and with which chore scope. */
const ENDING: Record<string, { name: string; scope?: "series" }> = {
  work: { name: "cancel" },
  exploration: { name: "tombstone" },
  update: { name: "tombstone" },
  chore: { name: "cancel", scope: "series" },
};

/** Whether `name` (with `scope`) is the ending transition of a task of `kind`. */
export function isEndingTransition(kind: string, name: string, scope?: string): boolean {
  const ending = ENDING[kind];
  return ending !== undefined && ending.name === name && ending.scope === scope;
}

export class DomainSuggestedActions implements SuggestedActions {
  constructor(
    private readonly services: { blocks: BlockService; projects: ProjectService; tasks: TaskService; chores: ChoreService },
  ) {}

  placeOf(subject: Subject): string | undefined {
    const { blocks, projects, tasks } = this.services;
    switch (subject.kind) {
      case "project":
        return projects.get(subject.id)?.homePageId;
      case "task":
        return tasks.get(subject.id)?.bodyPageId;
      case "page": {
        // Workspace pages and library documents: pages nobody owns, under no root or a project's.
        const page = blocks.getBlock(subject.id);
        if (page?.type !== "page" || page.owner !== null) return undefined;
        const root = blocks.rootOf(page.id)?.owner;
        return root === null || root?.kind === PROJECT_OWNER_KIND ? page.id : undefined;
      }
    }
  }

  check(subject: Subject, payload: ActionPayload): void {
    if (payload.action === "rename" && !payload.title.trim()) fail("A rename needs a title");
    if (payload.action !== "schedule" && payload.action !== "transition") return;
    if (subject.kind !== "task") fail(`Only tasks can have a ${payload.action} suggested`);
    const task = this.services.tasks.get(subject.id)!;

    if (payload.action === "schedule") {
      if (task.kind !== "chore") fail("Only chores have a schedule");
      if (task.state !== "todo") fail("Only a chore in to do can be rescheduled");
      if (payload.schedule !== null) {
        const parsed = scheduleSchema.safeParse(payload.schedule);
        if (!parsed.success) fail(parsed.error.issues[0]?.message ?? "Invalid schedule");
      }
      return;
    }

    if (!isEndingTransition(task.kind, payload.name, payload.scope)) {
      const ending = ENDING[task.kind]!;
      const subject = task.kind === "work" ? "Work" : `A ${task.kind}`;
      fail(`${subject} can only have "${ending.name}"${ending.scope ? ` with scope "${ending.scope}"` : ""} suggested`);
    }
    if (!kinds[task.kind].transitions[payload.name]!.from.includes(task.state)) {
      fail(`Cannot ${payload.name} a ${task.kind} that is ${task.state}`);
    }
    if (payload.scope === "series" && !isRecurring(choreAttributes(task).schedule)) {
      fail("Only a recurring chore has a series to cancel");
    }
  }

  baseOf(subject: Subject, payload: ActionPayload): string | undefined {
    const placeId = this.placeOf(subject);
    if (!placeId) return undefined;
    switch (payload.action) {
      case "rename":
        return plainText(this.services.blocks.getBlock(placeId)!.content);
      case "delete":
        return "";
      case "schedule": {
        const task = this.services.tasks.get(subject.id)!;
        return JSON.stringify({ state: task.state, schedule: choreAttributes(task).schedule ?? null });
      }
      case "transition":
        return this.services.tasks.get(subject.id)!.state;
    }
  }

  run(subject: Subject, payload: ActionPayload): void {
    const { blocks, projects, tasks, chores } = this.services;
    const placeId = this.placeOf(subject)!;
    switch (payload.action) {
      case "rename":
        this.apply(() => blocks.apply([{ op: "update", id: placeId, content: [{ text: payload.title.trim() }] }]));
        return;
      case "delete":
        if (subject.kind === "project") projects.delete(subject.id);
        else if (subject.kind === "task") tasks.delete(subject.id);
        else this.apply(() => blocks.apply([{ op: "delete", id: placeId }]));
        return;
      case "schedule":
        chores.setSchedule(subject.id, payload.schedule);
        return;
      case "transition":
        tasks.transition(subject.id, payload.name, {
          actor: HUMAN,
          ...(payload.scope ? { input: { scope: payload.scope } } : {}),
        });
        return;
    }
  }

  private apply(write: () => void) {
    try {
      write();
    } catch (error) {
      if (error instanceof BatchError) fail(error.error.message);
      throw error;
    }
  }
}
