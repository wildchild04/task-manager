import { describe, expect, it } from "vitest";

import { BlockOperationError } from "./errors";
import type { Block, BlockType, Operation } from "./types";
import type { BlockReader, ValidationOptions } from "./validate";
import { validateOperation } from "./validate";

function block(id: string, type: BlockType, parentId: string | null, extra: Partial<Block> = {}): Block {
  const props = type === "heading" ? { level: 1 } : type === "todo" ? { checked: false } : {};
  return { id, type, props, content: [], parentId, owner: null, createdAt: "", updatedAt: "", ...extra } as Block;
}

function readerOf(...blocks: Block[]): BlockReader {
  const map = new Map(blocks.map((b) => [b.id, b]));
  return { getBlock: (id) => map.get(id) };
}

// page P: [A (toggle) → [A1], D (divider)]; page Q; owned task page T: [T1]; comment C: [C1]
const fixture = readerOf(
  block("P", "page", null),
  block("A", "toggle", "P"),
  block("A1", "paragraph", "A"),
  block("D", "divider", "P"),
  block("Q", "page", null),
  block("T", "page", null, { owner: { kind: "task", id: "t1" } }),
  block("T1", "paragraph", "T"),
  block("C", "comment", null, { owner: { kind: "comment", id: "c1" } }),
  block("C1", "paragraph", "C"),
);

function rejects(op: Operation, code: BlockOperationError["code"], options?: ValidationOptions) {
  try {
    validateOperation(op, fixture, options);
  } catch (error) {
    expect(error).toBeInstanceOf(BlockOperationError);
    expect((error as BlockOperationError).code).toBe(code);
    return error as BlockOperationError;
  }
  throw new Error(`Expected ${op.op} to be rejected with ${code}`);
}

describe("insert", () => {
  it("rejects a duplicate ID", () => {
    rejects({ op: "insert", block: { id: "A", type: "paragraph" }, parentId: "P" }, "duplicate_id");
  });

  it("fills prop defaults", () => {
    const result = validateOperation({ op: "insert", block: { id: "n", type: "todo" }, parentId: "P" }, fixture);
    expect(result).toMatchObject({ kind: "insert", props: { checked: false }, content: [] });
  });

  it("names the invalid prop", () => {
    const error = rejects(
      { op: "insert", block: { id: "n", type: "heading", props: { level: 4 } }, parentId: "P" },
      "validation",
    );
    expect(error.path).toEqual(["props", "level"]);
  });

  it("rejects an unknown type", () => {
    rejects({ op: "insert", block: { id: "n", type: "kanban" as BlockType }, parentId: "P" }, "validation");
  });

  it("rejects content on a non-text type", () => {
    rejects({ op: "insert", block: { id: "n", type: "divider", content: [{ text: "x" }] }, parentId: "P" }, "validation");
  });

  it("rejects a non-page root", () => {
    rejects({ op: "insert", block: { id: "n", type: "paragraph" }, parentId: null }, "invalid_parent");
  });

  it("rejects a missing parent", () => {
    rejects({ op: "insert", block: { id: "n", type: "paragraph" }, parentId: "nope" }, "not_found");
  });

  it("rejects children under a leaf type", () => {
    rejects({ op: "insert", block: { id: "n", type: "paragraph" }, parentId: "D" }, "invalid_parent");
  });

  it("rejects a nested comment and an unowned comment root", () => {
    rejects({ op: "insert", block: { id: "n", type: "comment" }, parentId: "P" }, "invalid_parent");
    rejects({ op: "insert", block: { id: "n", type: "comment" }, parentId: null }, "invalid_parent");
  });

  it("accepts an owned page root and rejects an owned paragraph", () => {
    const result = validateOperation(
      { op: "insert", block: { id: "n", type: "page" }, owner: { kind: "task", id: "t2" } },
      fixture,
    );
    expect(result).toMatchObject({ kind: "insert", parentId: null, owner: { kind: "task", id: "t2" } });
    rejects({ op: "insert", block: { id: "n", type: "paragraph" }, owner: { kind: "task", id: "t2" } }, "invalid_parent");
  });

  it("requires the after block to be a sibling", () => {
    rejects({ op: "insert", block: { id: "n", type: "paragraph" }, parentId: "P", afterId: "A1" }, "invalid_position");
    rejects({ op: "insert", block: { id: "n", type: "page" }, parentId: null, afterId: "T" }, "invalid_position");
  });

  it("checks reference targets", () => {
    rejects({ op: "insert", block: { id: "n", type: "reference", props: { targetId: "nope" } }, parentId: "P" }, "not_found");
    rejects({ op: "insert", block: { id: "n", type: "reference", props: { targetId: "n" } }, parentId: "P" }, "validation");
  });
});

describe("suggestions", () => {
  // S: a pending insert suggestion on P holding S1.
  const reader = readerOf(
    block("P", "page", null),
    block("S", "suggestion", "P", { props: { action: "insert" } }),
    block("S1", "paragraph", "S"),
    block("X", "divider", "P"),
  );
  const check = (op: Operation) => () => validateOperation(op, reader);

  it("needs a target for replace and delete, and none for insert", () => {
    expect(
      validateOperation(
        { op: "insert", block: { id: "n", type: "suggestion", props: { action: "replace", targetId: "X" } }, parentId: "P" },
        reader,
      ),
    ).toMatchObject({ props: { action: "replace", targetId: "X" } });
    const error = rejects(
      { op: "insert", block: { id: "n", type: "suggestion", props: { action: "replace" } }, parentId: "P" },
      "validation",
    );
    expect(error.path).toEqual(["props", "targetId"]);
    rejects(
      { op: "insert", block: { id: "n", type: "suggestion", props: { action: "insert", targetId: "A" } }, parentId: "P" },
      "validation",
    );
  });

  it("holds no pages or suggestions, at any depth", () => {
    expect(check({ op: "insert", block: { id: "n", type: "page" }, parentId: "S1" })).toThrow(/inside a suggestion/);
    expect(check({ op: "insert", block: { id: "n", type: "suggestion", props: { action: "insert" } }, parentId: "S" })).toThrow(
      /inside a suggestion/,
    );
    expect(check({ op: "insert", block: { id: "n", type: "paragraph" }, parentId: "S1" })).not.toThrow();
  });

  it("can't be turned into or out of", () => {
    expect(check({ op: "update", id: "X", type: "suggestion", props: { action: "insert" } })).toThrow(/suggestion/);
    expect(check({ op: "update", id: "S", type: "divider" })).toThrow(/suggestion/);
  });
});

describe("update", () => {
  it("turns a paragraph into a todo with default props", () => {
    const result = validateOperation({ op: "update", id: "A1", type: "todo" }, fixture);
    expect(result).toMatchObject({ kind: "update", type: "todo", props: { checked: false } });
  });

  it("rejects text to non-text and comment type changes", () => {
    rejects({ op: "update", id: "A1", type: "divider" }, "invalid_type_change");
    rejects({ op: "update", id: "C", type: "page" }, "invalid_type_change");
  });

  it("keeps a root a page", () => {
    rejects({ op: "update", id: "P", type: "paragraph" }, "invalid_type_change");
  });
});

describe("move", () => {
  it("rejects moving into own descendant", () => {
    rejects({ op: "move", id: "A", parentId: "A1" }, "cycle");
    rejects({ op: "move", id: "A", parentId: "A" }, "cycle");
  });

  it("rejects moving an owned root", () => {
    rejects({ op: "move", id: "T", parentId: "P" }, "invalid_parent");
  });

  it("rejects placing a block after itself", () => {
    rejects({ op: "move", id: "A", parentId: "P", afterId: "A" }, "invalid_position");
  });
});

describe("protection hooks", () => {
  const options: ValidationOptions = {
    hooks: {
      task: ({ op, targetIsRoot }) => (op.op === "delete" && targetIsRoot ? "Task pages cannot be deleted" : undefined),
      comment: () => "Comment bodies change only through the comment service",
    },
  };

  it("lets a hook block deleting its root but allow edits inside", () => {
    rejects({ op: "delete", id: "T" }, "protected", options);
    expect(validateOperation({ op: "delete", id: "T1" }, fixture, options)).toEqual({ kind: "delete", id: "T1" });
  });

  it("protects descendants and new children", () => {
    rejects({ op: "update", id: "C1", content: [{ text: "x" }] }, "protected", options);
    rejects({ op: "insert", block: { id: "n", type: "paragraph" }, parentId: "C" }, "protected", options);
    rejects({ op: "move", id: "A1", parentId: "C" }, "protected", options);
  });

  it("can be bypassed by the owning service", () => {
    const result = validateOperation({ op: "update", id: "C1", content: [{ text: "x" }] }, fixture, {
      ...options,
      bypassProtectionFor: ["comment"],
    });
    expect(result).toMatchObject({ kind: "update", content: [{ text: "x" }] });
  });
});
