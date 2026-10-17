import { beforeEach, describe, expect, it } from "vitest";

import type { BlockRepository } from "~/domain/blocks/block.repository";
import { BlockService } from "~/domain/blocks/block.service";
import { BatchError, OrderIntegrityError } from "~/domain/blocks/errors";
import type { Batch, BlockType, NewBlock, Operation, TreeNode } from "~/domain/blocks/types";
import type { ProtectionHooks } from "~/domain/blocks/validate";

export type ContractSubject = {
  repo: BlockRepository;
  /** Rewrites a block's stored order pointer, bypassing validation. */
  corruptOrder(id: string, prevId: string | null): void;
};

export type ContractFactory = (hooks?: ProtectionHooks) => ContractSubject;

const text = (value: string) => [{ text: value }];
const nb = (id: string, type: BlockType, extra: Partial<NewBlock> = {}): NewBlock => ({ id, type, ...extra });
const ins = (block: NewBlock, parentId: string | null, afterId?: string): Operation => ({
  op: "insert",
  block,
  parentId,
  afterId,
});

function expectRejected(run: () => unknown, index: number, code: string) {
  let error: unknown;
  try {
    run();
  } catch (e) {
    error = e;
  }
  expect(error).toBeInstanceOf(BatchError);
  expect((error as BatchError).index).toBe(index);
  expect((error as BatchError).error.code).toBe(code);
  return error as BatchError;
}

function expectIntegrityError(run: () => unknown, parentId: string) {
  expect(run).toThrow(OrderIntegrityError);
  try {
    run();
  } catch (e) {
    expect((e as OrderIntegrityError).parentId).toBe(parentId);
  }
}

const ids = (nodes: { id: string }[]) => nodes.map((n) => n.id);
const childIds = (node: TreeNode | undefined) => (node?.children ?? []).map((c) => c.block.id);

export function blockRepositoryContract(name: string, factory: ContractFactory) {
  describe(`${name}: block contract`, () => {
    let subject: ContractSubject;
    let blocks: BlockService;

    const apply = (batch: Batch) => blocks.apply(batch);
    const children = (parentId: string) => ids(blocks.getChildren(parentId));

    /** Page P with children [A, B], plus page Q. */
    function seed() {
      apply([
        ins(nb("P", "page", { content: text("P") }), null),
        ins(nb("A", "paragraph", { content: text("A") }), "P"),
        ins(nb("B", "paragraph", { content: text("B") }), "P", "A"),
        ins(nb("Q", "page", { content: text("Q") }), null, "P"),
      ]);
    }

    beforeEach(() => {
      subject = factory();
      blocks = new BlockService(subject.repo);
      seed();
    });

    describe("block identity", () => {
      it("keeps the ID across update, move and type change", () => {
        apply([
          { op: "update", id: "A", content: text("A2") },
          { op: "move", id: "A", parentId: "Q" },
          { op: "update", id: "A", type: "todo" },
        ]);
        expect(blocks.getBlock("A")).toMatchObject({ id: "A", type: "todo", parentId: "Q" });
      });

      it("rejects a duplicate ID", () => {
        expectRejected(() => apply([ins(nb("A", "paragraph"), "P")]), 0, "duplicate_id");
      });
    });

    describe("block types", () => {
      it("accepts valid props", () => {
        apply([ins(nb("H", "heading", { props: { level: 2 } }), "P")]);
        expect((blocks.getBlock("H"))?.props).toEqual({ level: 2 });
      });

      it("rejects invalid props, naming the prop", () => {
        const error = expectRejected(() => apply([ins(nb("H", "heading", { props: { level: 4 } }), "P")]),
          0,
          "validation",
        );
        expect(error.error.path).toEqual(["props", "level"]);
      });

      it("rejects an unknown type", () => {
        expectRejected(() => apply([ins(nb("K", "kanban" as BlockType), "P")]), 0, "validation");
      });
    });

    describe("rich-text content", () => {
      it("round-trips spans unchanged", () => {
        const content = [{ text: "Hello " }, { text: "world", marks: ["bold" as const] }];
        apply([ins(nb("X", "paragraph", { content }), "P")]);
        expect((blocks.getBlock("X"))?.content).toEqual(content);
      });

      it("rejects content on a non-text type", () => {
        expectRejected(() => apply([ins(nb("D", "divider", { content: text("x") }), "P")]), 0, "validation");
      });
    });

    describe("ownership tree", () => {
      it("rejects a non-page block without a parent", () => {
        expectRejected(() => apply([ins(nb("X", "paragraph"), null)]), 0, "invalid_parent");
      });

      it("rejects nesting a comment block", () => {
        expectRejected(() => apply([ins(nb("C", "comment"), "P")]), 0, "invalid_parent");
        apply([{ op: "insert", block: nb("C", "comment"), owner: { kind: "comment", id: "c1" } }]);
        expectRejected(() => apply([{ op: "move", id: "C", parentId: "P" }]), 0, "invalid_parent");
      });

      it("requires a comment block to be owned", () => {
        expectRejected(() => apply([ins(nb("C", "comment"), null)]), 0, "invalid_parent");
      });

      it("stores an owned page root outside the workspace root pages", () => {
        apply([{ op: "insert", block: nb("T", "page"), owner: { kind: "task", id: "T1" } }]);
        expect(blocks.getBlock("T")).toMatchObject({ parentId: null, owner: { kind: "task", id: "T1" } });
        expect(ids(blocks.listRootPages())).toEqual(["P", "Q"]);
        expect(ids(blocks.getOwnedRoots({ kind: "task", id: "T1" }))).toEqual(["T"]);
      });

      it("rejects moving an owned root", () => {
        apply([{ op: "insert", block: nb("T", "page"), owner: { kind: "task", id: "T1" } }]);
        expectRejected(() => apply([{ op: "move", id: "T", parentId: "P" }]), 0, "invalid_parent");
      });

      it("rejects a missing parent", () => {
        expectRejected(() => apply([ins(nb("X", "paragraph"), "nope")]), 0, "not_found");
      });

      it("rejects children under leaf types", () => {
        apply([ins(nb("D", "divider"), "P")]);
        expectRejected(() => apply([ins(nb("X", "paragraph"), "D")]), 0, "invalid_parent");
        expectRejected(() => apply([{ op: "move", id: "A", parentId: "D" }]), 0, "invalid_parent");
      });
    });

    describe("sibling order", () => {
      it("inserts first", () => {
        apply([ins(nb("N", "paragraph"), "P")]);
        expect(children("P")).toEqual(["N", "A", "B"]);
      });

      it("inserts after a sibling", () => {
        apply([ins(nb("N", "paragraph"), "P", "A")]);
        expect(children("P")).toEqual(["A", "N", "B"]);
      });

      it("inserts at the end", () => {
        apply([ins(nb("N", "paragraph"), "P", "B")]);
        expect(children("P")).toEqual(["A", "B", "N"]);
      });

      it("rejects an after block that is not a sibling", () => {
        expectRejected(() => apply([ins(nb("N", "paragraph"), "Q", "A")]), 0, "invalid_position");
        expectRejected(() => apply([{ op: "move", id: "B", parentId: "Q", afterId: "A" }]), 0, "invalid_position");
      });

      it("orders workspace root pages", () => {
        apply([ins(nb("R", "page"), null, "P")]);
        expect(ids(blocks.listRootPages())).toEqual(["P", "R", "Q"]);
      });
    });

    describe("operations", () => {
      it("turns a paragraph into a todo, keeping content and children", () => {
        apply([ins(nb("A1", "paragraph"), "A"), { op: "update", id: "A", type: "todo" }]);
        expect(blocks.getBlock("A")).toMatchObject({ type: "todo", content: text("A"), props: { checked: false } });
        expect(children("A")).toEqual(["A1"]);
      });

      it("rejects turning a paragraph into a divider", () => {
        expectRejected(() => apply([{ op: "update", id: "A", type: "divider" }]), 0, "invalid_type_change");
      });

      it("moves within the same parent", () => {
        apply([ins(nb("C", "paragraph"), "P", "B"), { op: "move", id: "C", parentId: "P", afterId: "A" }]);
        expect(children("P")).toEqual(["A", "C", "B"]);
      });

      it("moves to the front and to the end", () => {
        apply([ins(nb("C", "paragraph"), "P", "B")]);
        apply([{ op: "move", id: "C", parentId: "P" }]);
        expect(children("P")).toEqual(["C", "A", "B"]);
        apply([{ op: "move", id: "C", parentId: "P", afterId: "B" }]);
        expect(children("P")).toEqual(["A", "B", "C"]);
      });

      it("moves after its own successor", () => {
        apply([{ op: "move", id: "A", parentId: "P", afterId: "B" }]);
        expect(children("P")).toEqual(["B", "A"]);
      });

      it("moves to another parent with its subtree in order", () => {
        apply([
          ins(nb("T", "toggle"), "P", "B"),
          ins(nb("T1", "paragraph"), "T"),
          ins(nb("T2", "paragraph"), "T", "T1"),
          { op: "move", id: "T", parentId: "Q" },
        ]);
        expect(children("P")).toEqual(["A", "B"]);
        expect(children("Q")).toEqual(["T"]);
        expect(children("T")).toEqual(["T1", "T2"]);
      });

      it("rejects moving into own descendant and changes nothing", () => {
        apply([ins(nb("A1", "paragraph"), "A")]);
        expectRejected(() => apply([{ op: "move", id: "A", parentId: "A1" }]), 0, "cycle");
        expect(children("P")).toEqual(["A", "B"]);
        expect(children("A")).toEqual(["A1"]);
      });

      it("deletes the subtree and closes the gap", () => {
        apply([
          ins(nb("C", "paragraph"), "P", "B"),
          ins(nb("B1", "paragraph"), "B"),
          ins(nb("B2", "page"), "B", "B1"),
          ins(nb("B21", "paragraph"), "B2"),
          { op: "delete", id: "B" },
        ]);
        expect(children("P")).toEqual(["A", "C"]);
        for (const id of ["B", "B1", "B2", "B21"]) expect(blocks.getBlock(id)).toBeUndefined();
      });

      it("deletes the first child", () => {
        apply([{ op: "delete", id: "A" }]);
        expect(children("P")).toEqual(["B"]);
      });
    });

    describe("atomic batches", () => {
      it("applies a split in one batch", () => {
        apply([
          { op: "update", id: "A", content: text("Hel") },
          ins(nb("A2", "paragraph", { content: text("lo") }), "P", "A"),
        ]);
        expect(children("P")).toEqual(["A", "A2", "B"]);
        expect((blocks.getBlock("A"))?.content).toEqual(text("Hel"));
      });

      it("rolls back the whole batch and reports the failing index", () => {
        expectRejected(() => apply([ins(nb("N", "paragraph"), "P"), ins(nb("A", "paragraph"), "P")]),
          1,
          "duplicate_id",
        );
        expect(blocks.getBlock("N")).toBeUndefined();
        expect(children("P")).toEqual(["A", "B"]);
      });
    });

    describe("references", () => {
      const ref = (id: string, targetId: string) => nb(id, "reference", { props: { targetId } });

      it("references a block on another page without moving it", () => {
        apply([ins(nb("X", "paragraph"), "Q"), ins(ref("R", "X"), "P", "B")]);
        expect((blocks.getBlock("X"))?.parentId).toBe("Q");
        expect(children("P")).toEqual(["A", "B", "R"]);
      });

      it("requires the target to exist, allowing one inserted earlier in the batch", () => {
        expectRejected(() => apply([ins(ref("R", "nope"), "P")]), 0, "not_found");
        apply([ins(nb("X", "paragraph"), "Q"), ins(ref("R", "X"), "P")]);
        expect(blocks.getBlock("R")).toBeDefined();
      });

      it("rejects a self-reference", () => {
        expectRejected(() => apply([ins(ref("R", "R"), "P")]), 0, "validation");
      });

      it("keeps a reference whose target is deleted, resolving as missing", () => {
        apply([ins(nb("X", "paragraph"), "Q"), ins(ref("R", "X"), "P"), { op: "delete", id: "Q" }]);
        expect(blocks.getBlock("R")).toBeDefined();
        expect(blocks.resolveReference("R", ["P"])).toEqual({ status: "missing", targetId: "X" });
        expect(ids(blocks.listIncomingReferences("X"))).toEqual(["R"]);
      });

      it("resolves a normal reference", () => {
        apply([ins(nb("X", "paragraph"), "Q"), ins(ref("R", "X"), "P")]);
        expect(blocks.resolveReference("R", ["P"])).toMatchObject({ status: "ok", target: { id: "X" } });
      });

      it("detects a reference to its own page", () => {
        apply([ins(ref("R", "P"), "P")]);
        expect(blocks.resolveReference("R", [])).toEqual({ status: "cycle", targetId: "P" });
      });

      it("detects an indirect cycle through two references", () => {
        apply([ins(ref("R1", "Q"), "P"), ins(ref("R2", "P"), "Q")]);
        expect(blocks.resolveReference("R1", ["P"])).toMatchObject({ status: "ok" });
        expect(blocks.resolveReference("R2", ["P", "Q"])).toEqual({ status: "cycle", targetId: "P" });
      });

      it("lists incoming references", () => {
        apply([ins(ref("R1", "A"), "Q"), ins(ref("R2", "A"), "Q", "R1")]);
        expect(ids(blocks.listIncomingReferences("A")).sort()).toEqual(["R1", "R2"]);
      });

      it("updates the target when a reference is retargeted", () => {
        apply([ins(ref("R", "A"), "Q"), { op: "update", id: "R", props: { targetId: "B" } }]);
        expect(blocks.listIncomingReferences("A")).toEqual([]);
        expect(ids(blocks.listIncomingReferences("B"))).toEqual(["R"]);
      });
    });

    describe("loading a tree", () => {
      it("returns nested content in order", () => {
        apply([
          ins(nb("T", "toggle"), "P", "B"),
          ins(nb("T1", "paragraph"), "T"),
          ins(nb("T2", "paragraph"), "T", "T1"),
        ]);
        const tree = blocks.loadTree("P");
        expect(childIds(tree)).toEqual(["A", "B", "T"]);
        expect(childIds(tree?.children?.[2])).toEqual(["T1", "T2"]);
      });

      it("does not expand sub-pages", () => {
        apply([ins(nb("S", "page"), "P", "B"), ins(nb("S1", "paragraph"), "S")]);
        const tree = blocks.loadTree("P");
        expect(tree?.children?.[2]).toMatchObject({ block: { id: "S" }, children: null });
        expect(childIds(blocks.loadTree("S"))).toEqual(["S1"]);
      });

      it("returns not found for a missing ID or a non-page block", () => {
        expect(blocks.loadTree("nope")).toBeUndefined();
        expect(blocks.loadTree("A")).toBeUndefined();
      });

      it("loads a comment body", () => {
        apply([
          { op: "insert", block: nb("C", "comment"), owner: { kind: "comment", id: "c1" } },
          ins(nb("C1", "paragraph"), "C"),
          ins(nb("C2", "todo"), "C", "C1"),
        ]);
        expect(childIds(blocks.loadTree("C"))).toEqual(["C1", "C2"]);
      });

      it("never lists owned roots as root pages", () => {
        apply([
          { op: "insert", block: nb("T", "page"), owner: { kind: "task", id: "t1" } },
          { op: "insert", block: nb("C", "comment"), owner: { kind: "comment", id: "c1" } },
        ]);
        expect(ids(blocks.listRootPages())).toEqual(["P", "Q"]);
      });
    });

    describe("order integrity", () => {
      it("fails loudly when a child is unreachable", () => {
        subject.corruptOrder("B", "nope");
        expectIntegrityError(() => blocks.getChildren("P"), "P");
        expectIntegrityError(() => blocks.loadTree("P"), "P");
      });
    });

    describe("protection hooks", () => {
      it("enforces hooks registered by owner kind, unless bypassed", () => {
        const guarded = factory({
          task: ({ op, targetIsRoot }) => (op.op === "delete" && targetIsRoot ? "task pages stay" : undefined),
          comment: () => "comments change through the comment service",
        });
        const service = new BlockService(guarded.repo);
        service.apply([
          { op: "insert", block: nb("T", "page"), owner: { kind: "task", id: "t1" } },
          ins(nb("T1", "paragraph"), "T"),
          { op: "insert", block: nb("C", "comment"), owner: { kind: "comment", id: "c1" } },
        ]);
        expectRejected(() => service.apply([{ op: "delete", id: "T" }]), 0, "protected");
        service.apply([{ op: "update", id: "T1", content: text("edited") }]);
        expectRejected(() => service.apply([ins(nb("C1", "paragraph"), "C")]), 0, "protected");
        service.apply([ins(nb("C1", "paragraph"), "C")], { bypassProtectionFor: ["comment"] });
        expect(childIds(service.loadTree("C"))).toEqual(["C1"]);
      });
    });
  });
}
