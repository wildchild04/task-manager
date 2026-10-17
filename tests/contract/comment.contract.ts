import { beforeEach, describe, expect, it } from "vitest";

import type { AppServices } from "~/composition";
import { BatchError } from "~/domain/blocks/errors";
import type { Operation } from "~/domain/blocks/types";
import type { CommentBlockInput } from "~/domain/comments/types";
import { TaskError } from "~/domain/tasks/errors";
import type { Actor } from "~/domain/tasks/types";

import type { ServicesFactory } from "./project.contract";

const builder: Actor = { kind: "agent", name: "builder" };
const para = (id: string, text: string): CommentBlockInput => ({ id, type: "paragraph", content: [{ text }] });

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

export function commentContract(name: string, factory: ServicesFactory) {
  describe(`${name}: comment contract`, () => {
    let services: AppServices;

    const childIds = (commentId: string) => services.comments.body(commentId)?.children?.map((c) => c.block.id);
    const firstText = (commentId: string) => services.comments.body(commentId)?.children?.[0]?.block.content[0]?.text;

    beforeEach(() => {
      services = factory();
      services.projects.create({ id: "P", title: "Project" });
      services.tasks.create({ id: "W", projectId: "P", kind: "work", title: "Work" });
    });

    describe("comment record", () => {
      it("adds a comment by an agent with a paragraph and a todo", () => {
        const comment = services.comments.add({
          id: "C",
          taskId: "W",
          author: builder,
          blocks: [para("p", "Found the cause"), { id: "t", type: "todo", content: [{ text: "Check logs" }] }],
        });
        expect(comment).toMatchObject({ id: "C", taskId: "W", author: builder, editedAt: null });
        expect(childIds("C")).toEqual(["p", "t"]);
        expect(services.blocks.getBlock(comment.bodyBlockId)).toMatchObject({
          type: "comment",
          owner: { kind: "comment", id: "C" },
        });
      });

      it("supports nested content and references", () => {
        services.comments.add({
          id: "C",
          taskId: "W",
          blocks: [
            { id: "g", type: "toggle", content: [{ text: "Details" }], children: [para("g1", "inside")] },
            { id: "r", type: "reference", props: { targetId: services.tasks.get("W")!.bodyPageId } },
          ],
        });
        expect(childIds("C")).toEqual(["g", "r"]);
        expect(services.comments.body("C")?.children?.[0]?.children?.map((c) => c.block.id)).toEqual(["g1"]);
      });

      it("creates nothing when the body cannot be created", () => {
        const invalid: CommentBlockInput = { id: "h", type: "heading", props: { level: 9 } };
        expect(errorOf(() => services.comments.add({ id: "C", taskId: "W", blocks: [para("p", "ok"), invalid] }))).toBeInstanceOf(
          BatchError,
        );
        expect(services.comments.get("C")).toBeUndefined();
        expect(services.blocks.getBlock("p")).toBeUndefined();
        expect(services.blocks.getOwnedRoots({ kind: "comment", id: "C" })).toEqual([]);
      });

      it("rejects a duplicate ID and an unknown task", () => {
        services.comments.add({ id: "C", taskId: "W", blocks: [] });
        expectTaskError(() => services.comments.add({ id: "C", taskId: "W", blocks: [] }), "duplicate_id");
        expectTaskError(() => services.comments.add({ id: "D", taskId: "nope", blocks: [] }), "not_found");
      });
    });

    describe("which tasks allow comments", () => {
      it("allows chores and done work", () => {
        services.tasks.create({ id: "CH", projectId: "P", kind: "chore", title: "Chore" });
        services.comments.add({ id: "C1", taskId: "CH", blocks: [para("a", "chore note")] });
        services.tasks.transition("W", "start");
        services.tasks.transition("W", "complete");
        services.comments.add({ id: "C2", taskId: "W", blocks: [para("b", "after done")] });
        expect(services.comments.list("CH")).toHaveLength(1);
        expect(services.comments.list("W")).toHaveLength(1);
      });

      it("rejects explorations and updates", () => {
        services.tasks.create({ id: "E", projectId: "P", kind: "exploration", title: "Idea" });
        expectTaskError(() => services.comments.add({ id: "C", taskId: "E", blocks: [] }), "validation");
      });
    });

    describe("block bodies", () => {
      it("rejects page and comment blocks in a body", () => {
        expectTaskError(
          () => services.comments.add({ id: "C", taskId: "W", blocks: [{ id: "x", type: "page" }] }),
          "validation",
        );
        services.comments.add({ id: "C", taskId: "W", blocks: [para("p", "text")] });
        expectTaskError(() => services.comments.edit("C", [{ op: "update", id: "p", type: "page" }]), "validation");
      });

      it("rejects changing a body through general block batches", () => {
        const comment = services.comments.add({ id: "C", taskId: "W", blocks: [para("p", "text")] });
        for (const op of [
          { op: "update", id: "p", content: [{ text: "sneaky" }] },
          { op: "insert", block: { id: "n", type: "paragraph" }, parentId: comment.bodyBlockId },
          { op: "delete", id: comment.bodyBlockId },
        ] as Operation[]) {
          const error = errorOf(() => services.blocks.apply([op]));
          expect((error as BatchError).error.code).toBe("protected");
        }
        expect(firstText("C")).toBe("text");
      });
    });

    describe("flat ordered list", () => {
      it("lists comments oldest first", () => {
        for (const id of ["C1", "C2", "C3"]) services.comments.add({ id, taskId: "W", blocks: [] });
        expect(services.comments.list("W").map((c) => c.id)).toEqual(["C1", "C2", "C3"]);
      });
    });

    describe("editing", () => {
      it("edits a comment and sets editedAt", () => {
        const created = services.comments.add({ id: "C", taskId: "W", author: builder, blocks: [para("p", "before")] });
        const edited = services.comments.edit("C", [
          { op: "update", id: "p", content: [{ text: "after" }] },
          { op: "insert", block: { id: "q", type: "paragraph" }, parentId: created.bodyBlockId, afterId: "p" },
        ]);
        expect(firstText("C")).toBe("after");
        expect(childIds("C")).toEqual(["p", "q"]);
        expect(edited.editedAt).not.toBeNull();
        expect(services.comments.get("C")).toMatchObject({ author: builder, createdAt: created.createdAt });
        expect(services.comments.get("C")?.editedAt).toBe(edited.editedAt);
      });

      it("rejects an edit reaching outside the comment and changes nothing", () => {
        services.comments.add({ id: "C", taskId: "W", blocks: [para("p", "mine")] });
        services.comments.add({ id: "D", taskId: "W", blocks: [para("d", "theirs")] });
        expectTaskError(
          () =>
            services.comments.edit("C", [
              { op: "update", id: "p", content: [{ text: "changed" }] },
              { op: "update", id: "d", content: [{ text: "hijacked" }] },
            ]),
          "validation",
        );
        expect(firstText("C")).toBe("mine");
        expect(firstText("D")).toBe("theirs");
        expect(services.comments.get("C")?.editedAt).toBeNull();
      });

      it("rejects an edit of the comment root itself", () => {
        const comment = services.comments.add({ id: "C", taskId: "W", blocks: [] });
        expectTaskError(() => services.comments.edit("C", [{ op: "delete", id: comment.bodyBlockId }]), "validation");
      });
    });

    describe("deleting", () => {
      it("removes the comment and its body, leaving references missing", () => {
        services.tasks.transition("W", "start");
        services.tasks.transition("W", "complete");
        const comment = services.comments.add({ id: "C", taskId: "W", blocks: [para("p", "a gap")] });
        services.tasks.create({
          id: "N",
          projectId: "P",
          kind: "exploration",
          title: "Idea",
          references: [
            { kind: "comment", id: "C" },
            { kind: "block", id: "p" },
          ],
        });
        services.comments.delete("C");
        expect(services.comments.get("C")).toBeUndefined();
        expect(services.blocks.getBlock(comment.bodyBlockId)).toBeUndefined();
        expect(services.blocks.getBlock("p")).toBeUndefined();
        expect(services.tasks.relations("N").map((r) => r.target.status)).toEqual(["missing", "missing"]);
      });
    });

    describe("referenceable", () => {
      it("starts an update from a comment on done work", () => {
        services.tasks.transition("W", "start");
        services.tasks.transition("W", "complete");
        services.comments.add({ id: "C", taskId: "W", blocks: [para("p", "Search is slow")] });
        services.tasks.create({
          id: "U",
          projectId: "P",
          kind: "update",
          title: "Faster search",
          iteratesOn: "W",
          references: [{ kind: "comment", id: "C" }],
        });
        expect(services.tasks.relations("U", "references")[0]?.target).toEqual({
          status: "ok",
          kind: "comment",
          id: "C",
          title: "Search is slow",
        });
      });
    });

    describe("returning work posts a comment", () => {
      it("posts the reason and extra blocks as a comment by the returning actor", () => {
        services.tasks.transition("W", "start");
        services.tasks.transition("W", "return", {
          actor: builder,
          input: { reason: "OAuth provider not decided", commentBlocks: [para("x", "Tried Google first")] },
        });
        expect(services.tasks.get("W")?.state).toBe("todo");
        const newest = services.comments.list("W").at(-1)!;
        expect(newest.author).toEqual(builder);
        expect(firstText(newest.id)).toBe("OAuth provider not decided");
        expect(services.comments.body(newest.id)?.children?.map((c) => c.block.content[0]?.text)).toEqual([
          "OAuth provider not decided",
          "Tried Google first",
        ]);
      });

      it("rolls the whole return back when the comment fails", () => {
        const task = services.tasks.get("W")!;
        services.comments.add({ id: "taken", taskId: "W", blocks: [] });
        services.tasks.transition("W", "start");
        const bodyBatch: Operation[] = [
          { op: "insert", block: { id: "u", type: "paragraph", content: [{ text: "Unknowns" }] }, parentId: task.bodyPageId },
        ];
        expectTaskError(
          () => services.tasks.transition("W", "return", { input: { reason: "blocked", bodyBatch, commentId: "taken" } }),
          "duplicate_id",
        );
        expect(services.tasks.get("W")?.state).toBe("in_progress");
        expect(services.comments.list("W").map((c) => c.id)).toEqual(["taken"]);
        expect(services.blocks.getBlock("u")).toBeUndefined();
        expect(services.tasks.history("W").map((r) => r.name)).toEqual(["start"]);
      });
    });
  });
}
