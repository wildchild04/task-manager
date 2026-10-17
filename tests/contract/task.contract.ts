import { beforeEach, describe, expect, it } from "vitest";

import type { AppServices } from "~/composition";
import { BatchError } from "~/domain/blocks/errors";
import type { Operation } from "~/domain/blocks/types";
import { TaskError } from "~/domain/tasks/errors";
import type { CreateTaskInput } from "~/domain/tasks/task.service";
import type { Actor, TaskKind } from "~/domain/tasks/types";

import type { ServicesFactory } from "./project.contract";

const builder: Actor = { kind: "agent", name: "builder" };

function errorOf(run: () => unknown): unknown {
  try {
    run();
  } catch (error) {
    return error;
  }
  throw new Error("Expected an error");
}

function expectTaskError(run: () => unknown, code: TaskError["code"]) {
  const error = errorOf(run);
  expect(error).toBeInstanceOf(TaskError);
  expect((error as TaskError).code).toBe(code);
}

export function taskContract(name: string, factory: ServicesFactory) {
  describe(`${name}: task contract`, () => {
    let services: AppServices;

    const create = (id: string, kind: TaskKind, extra: Partial<CreateTaskInput> = {}) =>
      services.tasks.create({ id, projectId: "P", kind, title: id, ...extra });

    const doneWork = (id: string) => {
      create(id, "work");
      services.tasks.transition(id, "start");
      return services.tasks.transition(id, "complete");
    };

    beforeEach(() => {
      services = factory();
      services.projects.create({ id: "P", title: "Project" });
      services.projects.create({ id: "P2", title: "Other project" });
    });

    describe("task entity", () => {
      it("creates a task with its kind, initial state and titled body page", () => {
        const task = services.tasks.create({ id: "W", projectId: "P", kind: "work", title: "Add login" });
        expect(task).toMatchObject({ id: "W", projectId: "P", kind: "work", state: "todo", title: "Add login" });
        expect(services.blocks.getBlock(task.bodyPageId)).toMatchObject({
          type: "page",
          owner: { kind: "task", id: "W" },
          content: [{ text: "Add login" }],
        });
      });

      it("rejects an unknown project", () => {
        expectTaskError(() => services.tasks.create({ id: "W", projectId: "nope", kind: "work", title: "x" }), "not_found");
      });

      it("rejects a duplicate ID", () => {
        create("W", "work");
        expectTaskError(() => create("W", "chore"), "duplicate_id");
      });

      it("never changes kind: promotion creates a new task instead", () => {
        create("E", "exploration");
        services.tasks.transition("E", "promote", { input: { workId: "W", title: "Implement" } });
        expect(services.tasks.get("E")?.kind).toBe("exploration");
        expect(services.tasks.get("W")?.kind).toBe("work");
      });

      it("creates nothing when the body page cannot be created", () => {
        const colliding = factoryWithIds(["home", "lib", "body-A", "body-A"]);
        colliding.projects.create({ id: "P", title: "P" });
        colliding.tasks.create({ id: "A", projectId: "P", kind: "work", title: "A" });
        expect(errorOf(() => colliding.tasks.create({ id: "B", projectId: "P", kind: "work", title: "B" }))).toBeInstanceOf(
          BatchError,
        );
        expect(colliding.tasks.get("B")).toBeUndefined();
      });

      it("takes its title from the body page", () => {
        const task = create("W", "work");
        services.blocks.apply([{ op: "update", id: task.bodyPageId, content: [{ text: "Add OAuth login" }] }]);
        expect(services.tasks.get("W")?.title).toBe("Add OAuth login");
      });

      it("protects the body page from deletion but allows editing it", () => {
        const task = create("W", "work");
        const error = errorOf(() => services.blocks.apply([{ op: "delete", id: task.bodyPageId }]));
        expect((error as BatchError).error.code).toBe("protected");
        services.blocks.apply([{ op: "insert", block: { id: "p", type: "paragraph" }, parentId: task.bodyPageId }]);
        expect(services.blocks.getChildren(task.bodyPageId).map((b) => b.id)).toEqual(["p"]);
      });

      it("keeps body pages out of the workspace and the library", () => {
        create("W", "work");
        expect(services.blocks.listRootPages()).toEqual([]);
        expect(services.library.getLibraryTree("P")).toEqual([]);
        expect(services.library.projectOfPage(services.tasks.get("W")!.bodyPageId)).toBe("P");
      });

      it("validates attributes against the kind's schema", () => {
        expectTaskError(() => create("W", "work", { attributes: { priority: "high" } }), "validation");
      });

      it("lists a project's tasks filtered by kind and state", () => {
        create("E1", "exploration");
        create("E2", "exploration");
        services.tasks.transition("E2", "tombstone");
        create("W", "work");
        services.tasks.create({ id: "X", projectId: "P2", kind: "exploration", title: "X" });
        services.tasks.transition("X", "tombstone");
        expect(services.tasks.list("P", { kind: "exploration", state: "tombstoned" }).map((t) => t.id)).toEqual(["E2"]);
        expect(services.tasks.list("P", { kind: "exploration" }).map((t) => t.id)).toEqual(["E1", "E2"]);
        expect(services.tasks.list("P").map((t) => t.id)).toEqual(["E1", "E2", "W"]);
      });
    });

    describe("lifecycle", () => {
      it("applies a valid transition", () => {
        create("W", "work");
        expect(services.tasks.transition("W", "start").state).toBe("in_progress");
      });

      it("rejects a transition not allowed from the current state", () => {
        create("W", "work");
        expectTaskError(() => services.tasks.transition("W", "complete"), "invalid_transition");
        expect(services.tasks.get("W")?.state).toBe("todo");
      });

      it("rejects every transition from a terminal state", () => {
        doneWork("W");
        for (const name of ["start", "pause", "return", "complete", "cancel", "reopen"]) {
          expectTaskError(() => services.tasks.transition("W", name, { input: { reason: "x" } }), "invalid_transition");
        }
      });

      it("rejects an unknown transition", () => {
        create("W", "work");
        expectTaskError(() => services.tasks.transition("W", "promote"), "invalid_transition");
      });

      it("pauses work and reopens cancelled work", () => {
        create("W", "work");
        services.tasks.transition("W", "start");
        expect(services.tasks.transition("W", "pause").state).toBe("todo");
        services.tasks.transition("W", "cancel");
        expect(services.tasks.transition("W", "reopen").state).toBe("todo");
      });

      it("revives a tombstoned exploration with everything kept", () => {
        const e = create("E", "exploration", { references: [{ kind: "task", id: create("W", "work").id }] });
        services.tasks.transition("E", "tombstone");
        const revived = services.tasks.transition("E", "revive");
        expect(revived).toMatchObject({ id: "E", state: "open", bodyPageId: e.bodyPageId });
        expect(services.tasks.relations("E")).toHaveLength(1);
        expect(services.tasks.history("E").map((r) => r.name)).toEqual(["tombstone", "revive"]);
      });

      it("handles chore completion and cancellation scope", () => {
        create("C", "chore");
        expectTaskError(() => services.tasks.transition("C", "cancel"), "validation");
        expectTaskError(() => services.tasks.transition("C", "cancel", { input: { scope: "series" } }), "validation");
        expect(services.tasks.transition("C", "cancel", { input: { scope: "occurrence" } }).state).toBe("cancelled");
        create("C2", "chore");
        expect(services.tasks.transition("C2", "complete").state).toBe("done");
      });
    });

    describe("returning work", () => {
      const unknowns: Operation[] = [
        { op: "insert", block: { id: "h", type: "heading", content: [{ text: "Unknowns" }] }, parentId: "" },
      ];
      const atBody = (bodyPageId: string): Operation[] =>
        unknowns.map((op) => ({ ...op, parentId: bodyPageId }) as Operation);

      it("returns work with the reason in history and the body page updated", () => {
        const task = create("W", "work");
        services.tasks.transition("W", "start");
        const returned = services.tasks.transition("W", "return", {
          actor: builder,
          input: { reason: "OAuth provider not decided", bodyBatch: atBody(task.bodyPageId) },
        });
        expect(returned.state).toBe("todo");
        expect(services.blocks.getChildren(task.bodyPageId).map((b) => b.id)).toEqual(["h"]);
        expect(services.tasks.history("W").at(-1)).toMatchObject({
          name: "return",
          fromState: "in_progress",
          toState: "todo",
          actor: builder,
          note: "OAuth provider not decided",
        });
      });

      it("rejects a return without a reason", () => {
        create("W", "work");
        services.tasks.transition("W", "start");
        expectTaskError(() => services.tasks.transition("W", "return", { input: { reason: "  " } }), "validation");
        expect(services.tasks.get("W")?.state).toBe("in_progress");
      });

      it("keeps the work in progress when the body update fails", () => {
        const task = create("W", "work");
        services.tasks.transition("W", "start");
        const invalid: Operation[] = [
          { op: "insert", block: { id: "x", type: "heading", props: { level: 9 } }, parentId: task.bodyPageId },
        ];
        expect(errorOf(() => services.tasks.transition("W", "return", { input: { reason: "r", bodyBatch: invalid } }))).toBeInstanceOf(
          BatchError,
        );
        expect(services.tasks.get("W")?.state).toBe("in_progress");
        expect(services.tasks.history("W").map((r) => r.name)).toEqual(["start"]);
      });

      it("rejects a body update that reaches outside the body page", () => {
        create("W", "work");
        const other = create("O", "work");
        services.tasks.transition("W", "start");
        expectTaskError(
          () => services.tasks.transition("W", "return", { input: { reason: "r", bodyBatch: atBody(other.bodyPageId) } }),
          "validation",
        );
        expect(services.blocks.getChildren(other.bodyPageId)).toEqual([]);
      });

      it("is not cancel", () => {
        create("W", "work");
        services.tasks.transition("W", "start");
        services.tasks.transition("W", "return", { input: { reason: "blocked" } });
        expect(services.tasks.list("P", { kind: "work", state: "cancelled" })).toEqual([]);
      });
    });

    describe("transition history", () => {
      it("records the actor and note", () => {
        create("W", "work");
        services.tasks.transition("W", "start", { actor: builder, note: "picking this up" });
        expect(services.tasks.history("W").at(-1)).toMatchObject({
          taskId: "W",
          name: "start",
          fromState: "todo",
          toState: "in_progress",
          actor: builder,
          note: "picking this up",
        });
      });

      it("defaults to the human actor and keeps entries oldest first", () => {
        create("W", "work");
        for (const name of ["start", "pause", "start", "complete"]) services.tasks.transition("W", name);
        const history = services.tasks.history("W");
        expect(history.map((r) => r.name)).toEqual(["start", "pause", "start", "complete"]);
        expect(history.every((r) => r.actor.kind === "human")).toBe(true);
      });

      it("rejects an agent without a name", () => {
        create("W", "work");
        expectTaskError(() => services.tasks.transition("W", "start", { actor: { kind: "agent", name: "" } }), "validation");
      });
    });

    describe("promotion", () => {
      it("promotes an exploration into exactly one work task born from it", () => {
        create("E", "exploration");
        services.tasks.transition("E", "promote", { input: { workId: "W", title: "Implement search" } });
        expect(services.tasks.get("E")?.state).toBe("promoted");
        expect(services.tasks.get("W")).toMatchObject({ kind: "work", state: "todo", title: "Implement search", projectId: "P" });
        expect(services.tasks.relations("W", "born_from").map((r) => r.to)).toEqual([{ kind: "task", id: "E" }]);
        expectTaskError(
          () => services.tasks.transition("E", "promote", { input: { workId: "W2", title: "Again" } }),
          "invalid_transition",
        );
      });

      it("is atomic when creating the work fails", () => {
        create("E", "exploration");
        create("W", "work");
        expectTaskError(
          () => services.tasks.transition("E", "promote", { input: { workId: "W", title: "Collides" } }),
          "duplicate_id",
        );
        expect(services.tasks.get("E")?.state).toBe("open");
        expect(services.tasks.history("E")).toEqual([]);
        expect(services.tasks.incoming({ kind: "task", id: "E" })).toEqual([]);
      });

      it("promotes an update too", () => {
        doneWork("W1");
        create("U", "update", { iteratesOn: "W1" });
        services.tasks.transition("U", "promote", { input: { workId: "W2", title: "Next iteration" } });
        expect(services.tasks.relations("W2", "born_from")[0]?.to.id).toBe("U");
      });
    });

    describe("relations", () => {
      it("requires an update to iterate on done work in its project", () => {
        expectTaskError(() => create("U", "update"), "invalid_relation");
        create("W", "work");
        services.tasks.transition("W", "start");
        expectTaskError(() => create("U", "update", { iteratesOn: "W" }), "invalid_relation");
        expect(services.tasks.get("U")).toBeUndefined();
        services.tasks.create({ id: "X", projectId: "P2", kind: "work", title: "X" });
        services.tasks.transition("X", "start");
        services.tasks.transition("X", "complete");
        expectTaskError(() => create("U", "update", { iteratesOn: "X" }), "invalid_relation");
      });

      it("rejects lineage relations added by hand", () => {
        create("E", "exploration");
        create("W", "work");
        expectTaskError(() => services.tasks.addRelation("born_from", "W", { kind: "task", id: "E" }), "invalid_relation");
        expectTaskError(() => services.tasks.addRelation("iterates_on", "W", { kind: "task", id: "E" }), "invalid_relation");
      });

      it("starts an exploration from several sources", () => {
        create("T", "exploration");
        services.tasks.transition("T", "tombstone");
        services.tasks.create({ id: "U2", projectId: "P2", kind: "work", title: "W" });
        const project = services.projects.get("P")!;
        services.blocks.apply([
          { op: "insert", block: { id: "K", type: "page", content: [{ text: "Notes" }] }, parentId: project.libraryRootId },
        ]);
        create("N", "exploration", {
          references: [
            { kind: "task", id: "T" },
            { kind: "task", id: "U2" },
            { kind: "block", id: "K" },
          ],
        });
        expect(services.tasks.get("N")?.state).toBe("open");
        expect(services.tasks.relations("N", "references").map((r) => r.target.status)).toEqual(["ok", "ok", "ok"]);
        expect(services.tasks.get("T")?.state).toBe("tombstoned");
      });

      it("adds and removes references", () => {
        create("W", "work");
        const project = services.projects.get("P")!;
        services.blocks.apply([{ op: "insert", block: { id: "K", type: "page" }, parentId: project.libraryRootId }]);
        services.tasks.addReference("W", { kind: "block", id: "K" });
        expect(services.tasks.relations("W").map((r) => r.to.id)).toEqual(["K"]);
        services.tasks.removeReference("W", { kind: "block", id: "K" });
        expect(services.tasks.relations("W")).toEqual([]);
      });

      it("rejects self, duplicate, unknown-kind and missing references", () => {
        create("W", "work");
        create("O", "work");
        expectTaskError(() => services.tasks.addReference("W", { kind: "task", id: "W" }), "invalid_relation");
        services.tasks.addReference("W", { kind: "task", id: "O" });
        expectTaskError(() => services.tasks.addReference("W", { kind: "task", id: "O" }), "invalid_relation");
        expectTaskError(() => services.tasks.addReference("W", { kind: "kanban", id: "O" }), "invalid_relation");
        expectTaskError(() => services.tasks.addReference("W", { kind: "block", id: "nope" }), "not_found");
      });

      it("references cancelled work and a single paragraph", () => {
        create("C", "work");
        services.tasks.transition("C", "cancel");
        doneWork("W");
        const project = services.projects.get("P")!;
        services.blocks.apply([
          { op: "insert", block: { id: "K", type: "page" }, parentId: project.libraryRootId },
          { op: "insert", block: { id: "para", type: "paragraph", content: [{ text: "gap" }] }, parentId: "K" },
        ]);
        create("U", "update", { iteratesOn: "W", references: [{ kind: "task", id: "C" }] });
        create("N", "exploration", { references: [{ kind: "block", id: "para" }] });
        expect(services.tasks.relations("N")[0]?.target).toEqual({ status: "ok", kind: "block", id: "para", title: "gap" });
      });

      it("keeps lineage relations permanent", () => {
        create("E", "exploration");
        services.tasks.transition("E", "promote", { input: { workId: "W", title: "W" } });
        const bornFrom = services.tasks.relations("W", "born_from")[0]!;
        expectTaskError(() => services.tasks.removeRelation(bornFrom.id), "invalid_relation");
      });

      it("resolves a deleted referenced block as missing", () => {
        create("W", "work");
        const project = services.projects.get("P")!;
        services.blocks.apply([{ op: "insert", block: { id: "K", type: "page" }, parentId: project.libraryRootId }]);
        services.tasks.addReference("W", { kind: "block", id: "K" });
        services.blocks.apply([{ op: "delete", id: "K" }]);
        expect(services.tasks.relations("W")[0]?.target).toEqual({ status: "missing", kind: "block", id: "K" });
      });

      it("lists tasks referencing a tombstoned idea", () => {
        create("T", "exploration");
        services.tasks.transition("T", "tombstone");
        create("N1", "exploration", { references: [{ kind: "task", id: "T" }] });
        create("N2", "exploration", { references: [{ kind: "task", id: "T" }] });
        expect(services.tasks.incoming({ kind: "task", id: "T" }, "references").map((r) => r.fromTaskId)).toEqual(["N1", "N2"]);
      });
    });

    describe("lineage", () => {
      const shape = (node: ReturnType<AppServices["tasks"]["lineage"]>): unknown =>
        node && { id: node.task.id, children: node.children.map(shape) };

      it("returns the same linear history from any task in it", () => {
        create("E", "exploration");
        services.tasks.transition("E", "promote", { input: { workId: "W1", title: "W1" } });
        services.tasks.transition("W1", "start");
        services.tasks.transition("W1", "complete");
        create("U1", "update", { iteratesOn: "W1" });
        services.tasks.transition("U1", "promote", { input: { workId: "W2", title: "W2" } });
        const expected = { id: "E", children: [{ id: "W1", children: [{ id: "U1", children: [{ id: "W2", children: [] }] }] }] };
        for (const id of ["E", "W1", "U1", "W2"]) expect(shape(services.tasks.lineage(id))).toEqual(expected);
      });

      it("branches when several updates iterate on the same work", () => {
        doneWork("W1");
        create("U1", "update", { iteratesOn: "W1" });
        create("U2", "update", { iteratesOn: "W1" });
        expect(shape(services.tasks.lineage("W1"))).toEqual({
          id: "W1",
          children: [
            { id: "U1", children: [] },
            { id: "U2", children: [] },
          ],
        });
      });

      it("ignores references and has no lineage for chores", () => {
        create("E", "exploration");
        create("N", "exploration", { references: [{ kind: "task", id: "E" }] });
        expect(shape(services.tasks.lineage("N"))).toEqual({ id: "N", children: [] });
        create("C", "chore");
        expect(services.tasks.lineage("C")).toBeUndefined();
      });
    });

    function factoryWithIds(ids: string[]): AppServices {
      const queue = [...ids];
      return factory({ newId: () => queue.shift() ?? crypto.randomUUID() });
    }
  });
}
