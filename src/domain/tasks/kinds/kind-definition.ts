import type { z } from "zod";

import type { Repositories } from "../../unit-of-work";
import type { Actor, Task, TaskKind } from "../types";

/** What a transition effect can do, inside the transition's unit of work. */
export type EffectContext<Input> = {
  task: Task;
  input: Input;
  actor: Actor;
  at: string;
  repositories: Repositories;
  /** Creates a task (with its body page) in the same unit of work. */
  createTask(input: { id: string; projectId: string; kind: TaskKind; title: string }): Task;
};

export type TransitionDefinition<State extends string, Input = undefined> = {
  from: readonly State[];
  to: State;
  /** Schema for the transition's input; omitted when it takes none. */
  input?: z.ZodType<Input>;
  /** Extra writes made in the same unit of work as the state change. */
  effect?: (context: EffectContext<Input>) => void;
  /** Turns the input into the history note, when the input carries it (e.g. a return reason). */
  note?: (input: Input) => string | undefined;
};

export type KindDefinition<State extends string = string> = {
  kind: TaskKind;
  states: readonly State[];
  initial: State;
  terminal: readonly State[];
  // Inputs differ per transition; each definition's schema checks its own.
  transitions: Readonly<Record<string, TransitionDefinition<State, any>>>;
  attributes: z.ZodType<Record<string, unknown>>;
};

/** Helper that keeps state names checked while defining a kind. */
export function defineKind<State extends string>(definition: KindDefinition<State>): KindDefinition<State> {
  return definition;
}
