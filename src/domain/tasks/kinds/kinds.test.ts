import { describe, expect, it } from "vitest";

import { TASK_KINDS } from "../types";
import { kinds } from "./index";

describe.each(TASK_KINDS)("%s kind definition", (kind) => {
  const definition = kinds[kind];

  it("is registered under its own name", () => {
    expect(definition.kind).toBe(kind);
  });

  it("starts in a declared state", () => {
    expect(definition.states).toContain(definition.initial);
  });

  it("only uses declared states in transitions", () => {
    for (const [name, transition] of Object.entries(definition.transitions)) {
      for (const state of [...transition.from, transition.to]) {
        expect(definition.states, `${name} uses ${state}`).toContain(state);
      }
    }
  });

  it("has no transitions out of terminal states", () => {
    for (const [name, transition] of Object.entries(definition.transitions)) {
      for (const terminal of definition.terminal) {
        expect(transition.from, `${name} leaves terminal ${terminal}`).not.toContain(terminal);
      }
    }
  });

  it("can reach every state from the initial state", () => {
    const reached = new Set([definition.initial]);
    let grew = true;
    while (grew) {
      grew = false;
      for (const transition of Object.values(definition.transitions)) {
        if (transition.from.some((s) => reached.has(s)) && !reached.has(transition.to)) {
          reached.add(transition.to);
          grew = true;
        }
      }
    }
    expect([...reached].sort()).toEqual([...definition.states].sort());
  });
});
