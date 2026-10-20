import { describe, expect, it } from "vitest";

import { formatBarFor } from "../../app/editor/format-bar";
import { type EditorState, stateFromTree } from "~/editor/editor-state";
import type { Block, RichText, TreeNode } from "~/domain/blocks/types";

const node = (id: string, type: string, content: RichText = [], children: TreeNode[] = []): TreeNode => ({
  block: { id, type, props: {}, content, parentId: null, owner: null, createdAt: "", updatedAt: "" } as unknown as Block,
  children,
});

const state: EditorState = stateFromTree(
  node("page", "page", [{ text: "Title" }], [
    node("p", "paragraph", [{ text: "Hello " }, { text: "bold", marks: ["bold"] }, { text: " and " }, { text: "link", marks: [{ type: "link", href: "https://x.dev" }] }]),
    node("c", "code", [{ text: "let x = 1;" }]),
    node("t", "table", [], [node("r", "table_row", [], [node("cell", "table_cell", [{ text: "cell" }])])]),
  ]),
);
const select = (blockId: string, anchor: number, focus: number) => ({ blockId, anchor, focus });

describe("the formatting bar", () => {
  it("shows for selected text, with the marks the whole selection has pressed", () => {
    const bar = formatBarFor(state, select("p", 6, 10));
    expect(bar).toEqual({ turnInto: true, pressed: new Set(["bold"]), link: false });
    expect(formatBarFor(state, select("p", 4, 10))!.pressed.size).toBe(0);
    expect(formatBarFor(state, select("p", 15, 19))!.link).toBe(true);
  });

  it("doesn't show for a caret, in the title or in code", () => {
    expect(formatBarFor(state, select("p", 3, 3))).toBeNull();
    expect(formatBarFor(state, select("page", 0, 3))).toBeNull();
    expect(formatBarFor(state, select("c", 0, 3))).toBeNull();
  });

  it("offers no Turn into in a table cell", () => {
    expect(formatBarFor(state, select("cell", 0, 4))!.turnInto).toBe(false);
  });
});
