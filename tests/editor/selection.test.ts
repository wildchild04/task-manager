import { beforeEach, describe, expect, it } from "vitest";

import { type AppServices, createInMemoryServices } from "~/composition";
import { fromMarkdown, type MarkdownReader, toMarkdown } from "~/domain/blocks/markdown";
import type { NewBlock, Operation } from "~/domain/blocks/types";
import { SLASH_COMMANDS } from "~/editor/block-types";
import { blockTrees } from "~/editor/clipboard";
import { Editor } from "~/editor/editor";
import { caret, type EditorState, selectableOrder, selectedRoots, stateFromTree } from "~/editor/editor-state";
import { plain } from "~/editor/rich-text";

type Seed = NewBlock & { children?: Seed[] };

const reader: MarkdownReader = {
  mentionTarget: () => null,
  referenceTarget: () => null,
  appLink: () => undefined,
  pageId: (id) => id,
};

describe("selections beyond one block", () => {
  let services: AppServices;
  let editor: Editor;
  let ids: number;

  const seed = (blocks: Seed[], options: { subPages?: boolean } = {}) => {
    const ops: Operation[] = [{ op: "insert", block: { id: "page", type: "page", content: [{ text: "Title" }] }, parentId: null }];
    const add = (nodes: Seed[], parentId: string) => {
      let afterId: string | null = null;
      for (const { children, ...block } of nodes) {
        ops.push({ op: "insert", block, parentId, afterId });
        add(children ?? [], block.id);
        afterId = block.id;
      }
    };
    add(blocks, "page");
    services.blocks.apply(ops);
    editor = new Editor(stateFromTree(services.blocks.loadTree("page")!), {
      newId: () => `n${++ids}`,
      now: () => 0,
      onOps: (batch) => services.blocks.apply(batch),
      ...options,
    });
  };
  const p = (id: string, value: string, children?: Seed[]): Seed => ({ id, type: "paragraph", content: [{ text: value }], children });
  const li = (id: string, value: string): Seed => ({ id, type: "bulleted_list_item", content: [{ text: value }] });
  const toggle = (id: string, value: string, children: Seed[]): Seed => ({ id, type: "toggle", content: [{ text: value }], children });
  const subPage = (id: string, title: string): Seed => ({ id, type: "page", content: [{ text: title }] });
  const table = (id: string): Seed => ({
    id,
    type: "table",
    props: { headerRow: true, headerColumn: false },
    children: [
      { id: `${id}-r1`, type: "table_row", children: [{ id: `${id}-a`, type: "table_cell", content: [{ text: "a" }] }] },
      { id: `${id}-r2`, type: "table_row", children: [{ id: `${id}-b`, type: "table_cell", content: [{ text: "b" }] }] },
    ],
  });
  const md = (markdown: string) => fromMarkdown(markdown, { findTarget: () => null, newId: () => `m${++ids}` });
  /** The stored page as `type:text` lines, children indented. */
  const outline = (state?: EditorState) => {
    const s = state ?? stateFromTree(services.blocks.loadTree("page")!);
    const lines: string[] = [];
    const visit = (id: string, depth: number) => {
      for (const child of s.blocks[id]!.children) {
        if (s.blocks[child]!.type === "table_row") continue;
        lines.push(`${"  ".repeat(depth)}${s.blocks[child]!.type}:${plain(s.blocks[child]!.content)}`);
        visit(child, depth + 1);
      }
    };
    visit(s.rootId, 0);
    return lines;
  };
  const range = (from: string, fromOffset: number, to: string, toOffset: number) =>
    editor.setRange({ anchor: { blockId: from, offset: fromOffset }, focus: { blockId: to, offset: toOffset } });

  beforeEach(() => {
    services = createInMemoryServices();
    ids = 0;
  });

  describe("the selectable blocks", () => {
    it("are every block, a table standing for its cells and a closed toggle for its children", () => {
      seed([p("a", "A"), table("t"), toggle("g", "G", [p("c", "C")]), subPage("s", "Sub")]);
      expect(selectableOrder(editor.state, new Set(["g"]))).toEqual(["a", "t", "g", "s"]);
      expect(selectableOrder(editor.state)).toEqual(["a", "t", "g", "c", "s"]);
    });

    it("act on the covered blocks whose parent isn't covered", () => {
      seed([p("a", "A"), toggle("g", "G", [p("c1", "1"), p("c2", "2")]), p("b", "B")]);
      expect(selectedRoots(editor.state, { anchor: "b", focus: "g" })).toEqual(["g", "b"]);
      expect(selectedRoots(editor.state, { anchor: "c2", focus: "b" })).toEqual(["c2", "b"]);
    });
  });

  describe("editing over text across blocks", () => {
    it("joins the two ends when typing, undone in one step back to the range", () => {
      seed([p("a", "Hello"), p("b", "world")]);
      range("a", 3, "b", 3);
      editor.type("p");
      expect(outline()).toEqual(["paragraph:Helpld"]);
      expect(editor.selection).toEqual(caret("a", 4));
      expect(editor.range).toBeNull();
      editor.undo();
      expect(outline()).toEqual(["paragraph:Hello", "paragraph:world"]);
      expect(editor.range).toEqual({ anchor: { blockId: "a", offset: 3 }, focus: { blockId: "b", offset: 3 } });
    });

    it("removes the blocks between with Backspace, whichever way the range runs", () => {
      seed([p("a", "Intro text"), li("l1", "one"), li("l2", "two"), p("b", "Outro text")]);
      range("b", 6, "a", 6);
      editor.deleteBackward();
      expect(outline()).toEqual(["paragraph:Intro text"]);
      expect(plain(editor.state.blocks.a!.content)).toBe("Intro text");
    });

    it("keeps a sub-page in the selection, after the joined block", () => {
      seed([p("a", "First"), subPage("s", "Sub"), p("b", "Second")]);
      range("a", 2, "b", 3);
      editor.deleteForward();
      expect(outline()).toEqual(["paragraph:Fiond", "page:Sub"]);
    });

    it("splits at the join on Enter, as one step", () => {
      seed([p("a", "Hello"), p("b", "world")]);
      range("a", 3, "b", 3);
      editor.enter();
      expect(outline()).toEqual(["paragraph:Hel", "paragraph:ld"]);
      editor.undo();
      expect(outline()).toEqual(["paragraph:Hello", "paragraph:world"]);
    });

    it("moves what follows the range in a removed toggle under the first block", () => {
      seed([p("a", "Start"), toggle("g", "Toggle", [p("c1", "one"), p("c2", "two"), p("c3", "three")])]);
      range("a", 2, "c2", 1);
      editor.deleteBackward();
      expect(outline()).toEqual(["paragraph:Stwo", "  paragraph:three"]);
    });

    it("moves the last block's children under the first block", () => {
      seed([p("a", "Start"), p("b", "End", [p("c", "child")])]);
      range("a", 5, "b", 0);
      editor.deleteBackward();
      expect(outline()).toEqual(["paragraph:StartEnd", "  paragraph:child"]);
    });

    it("removes a table the range ends in, whole, joining nothing across it", () => {
      seed([p("a", "Start"), table("t"), p("b", "After")]);
      range("a", 2, "t-b", 1);
      editor.deleteBackward();
      expect(outline()).toEqual(["paragraph:St", "paragraph:After"]);
    });

    it("pastes blocks at the join", () => {
      seed([p("a", "Hello"), p("b", "world")]);
      range("a", 3, "b", 3);
      expect(editor.paste(md("- x\n- y"))).toBe(true);
      expect(outline()).toEqual(["paragraph:Hel", "bulleted_list_item:x", "bulleted_list_item:y", "paragraph:ld"]);
      editor.undo();
      expect(outline()).toEqual(["paragraph:Hello", "paragraph:world"]);
    });
  });

  describe("selected blocks", () => {
    it("selects with Escape (a cell selects its table), steps and extends", () => {
      seed([p("a", "A"), table("t"), p("b", "B"), p("c", "C")]);
      editor.setSelection(caret("t-a", 0));
      editor.selectBlock("t-a");
      expect(editor.blocks).toEqual({ anchor: "t", focus: "t" });
      editor.stepBlocks(1, true);
      editor.stepBlocks(1, true);
      expect(editor.selectedRoots()).toEqual(["t", "b", "c"]);
      editor.stepBlocks(-1, false);
      expect(editor.selectedRoots()).toEqual(["b"]);
      editor.selectAll();
      expect(editor.selectedRoots()).toEqual(["a", "t", "b", "c"]);
    });

    it("deletes them, the caret at the end of the block before, and undo selects them again", () => {
      seed([p("a", "Before"), { id: "h", type: "heading", props: { level: 2 }, content: [{ text: "H" }] }, p("b", "Para"), p("c", "After")]);
      editor.selectBlocks({ anchor: "h", focus: "b" });
      editor.deleteBackward();
      expect(outline()).toEqual(["paragraph:Before", "paragraph:After"]);
      expect(editor.selection).toEqual(caret("a", 6));
      expect(editor.blocks).toBeNull();
      editor.undo();
      expect(outline()).toEqual(["paragraph:Before", "heading:H", "paragraph:Para", "paragraph:After"]);
      expect(editor.blocks).toEqual({ anchor: "h", focus: "b" });
    });

    it("keeps a selected sub-page, still selected", () => {
      seed([p("a", "A"), subPage("s", "Sub"), p("b", "B")]);
      editor.selectBlocks({ anchor: "a", focus: "b" });
      editor.deleteForward();
      expect(outline()).toEqual(["page:Sub"]);
      expect(editor.selectedRoots()).toEqual(["s"]);
    });

    it("leaves an empty paragraph when every block goes", () => {
      seed([p("a", "A"), p("b", "B")]);
      editor.selectAll();
      editor.deleteBlocks();
      expect(outline()).toEqual(["paragraph:"]);
    });

    it("duplicates a toggle with its children, selecting the copy", () => {
      seed([toggle("g", "G", [p("c1", "one"), subPage("s", "Sub"), p("c2", "two")]), p("b", "B")]);
      editor.selectBlock("g");
      editor.duplicateBlocks();
      expect(outline()).toEqual([
        "toggle:G",
        "  paragraph:one",
        "  page:Sub",
        "  paragraph:two",
        "toggle:G",
        "  paragraph:one",
        "  paragraph:two",
        "paragraph:B",
      ]);
      const copy = editor.state.blocks.page!.children[1]!;
      expect(editor.blocks).toEqual({ anchor: copy, focus: copy });
    });

    it("nests and un-nests sibling blocks together", () => {
      seed([li("a", "one"), li("b", "two"), li("c", "three"), li("d", "four")]);
      editor.selectBlocks({ anchor: "b", focus: "c" });
      editor.tab();
      expect(outline()).toEqual(["bulleted_list_item:one", "  bulleted_list_item:two", "  bulleted_list_item:three", "bulleted_list_item:four"]);
      editor.tab(true);
      expect(outline()).toEqual(["bulleted_list_item:one", "bulleted_list_item:two", "bulleted_list_item:three", "bulleted_list_item:four"]);
      expect(editor.blocks).toEqual({ anchor: "b", focus: "c" });
    });

    it("enters the last selected text block on Enter", () => {
      seed([p("a", "A"), p("b", "Bee"), { id: "d", type: "divider" }, p("c", "C")]);
      editor.selectBlocks({ anchor: "a", focus: "b" });
      editor.editBlocks();
      expect(editor.selection).toEqual(caret("b", 3));
      expect(editor.blocks).toBeNull();
      editor.selectBlock("d");
      editor.editBlocks();
      expect(editor.selection).toEqual(caret("c", 0));
    });
  });

  describe("moving blocks", () => {
    it("moves the caret's block up, keeping the caret", () => {
      seed([p("a", "A"), p("b", "B"), p("c", "C")]);
      editor.setSelection(caret("c", 1));
      editor.moveBlocks(-1);
      expect(outline()).toEqual(["paragraph:A", "paragraph:C", "paragraph:B"]);
      expect(editor.selection).toEqual(caret("c", 1));
    });

    it("moves out of a toggle at its first child, and nowhere at the page's edge", () => {
      seed([toggle("g", "G", [p("c", "C")]), p("b", "B")]);
      editor.toggleOpen("g");
      editor.selectBlock("c");
      editor.moveBlocks(-1);
      expect(outline()).toEqual(["paragraph:C", "toggle:G", "paragraph:B"]);
      expect(editor.moveBlocks(-1)).toBe(false);
      editor.undo();
      expect(outline()).toEqual(["toggle:G", "  paragraph:C", "paragraph:B"]);
      expect(editor.blocks).toEqual({ anchor: "c", focus: "c" });
    });

    it("moves a selection of siblings down past the next block", () => {
      seed([p("a", "A"), p("b", "B"), p("c", "C")]);
      editor.selectBlocks({ anchor: "a", focus: "b" });
      editor.moveBlocks(1);
      expect(outline()).toEqual(["paragraph:C", "paragraph:A", "paragraph:B"]);
    });

    it("moves a cell's row", () => {
      seed([table("t")]);
      editor.setSelection(caret("t-b", 0));
      editor.moveBlocks(-1);
      expect(editor.state.blocks.t!.children).toEqual(["t-r2", "t-r1"]);
    });

    it("drops blocks inside a toggle as its first children, and refuses drops into themselves or a table", () => {
      seed([p("a", "A"), p("b", "B"), toggle("g", "G", [p("c", "C")]), table("t")]);
      expect(editor.dropBlocks(["a", "b"], { parentId: "g", afterId: null })).toBe(true);
      expect(outline()).toEqual(["toggle:G", "  paragraph:A", "  paragraph:B", "  paragraph:C", "table:"]);
      expect(editor.blocks).toEqual({ anchor: "a", focus: "b" });
      expect(editor.dropBlocks(["g"], { parentId: "c", afterId: null })).toBe(false);
      expect(editor.dropBlocks(["c"], { parentId: "t-r1", afterId: null })).toBe(false);
      expect(editor.dropBlocks(["a"], { parentId: "g", afterId: "a" })).toBe(false);
      editor.undo();
      expect(outline()).toEqual(["paragraph:A", "paragraph:B", "toggle:G", "  paragraph:C", "table:"]);
    });
  });

  describe("turning blocks into another type", () => {
    const bulleted = { type: "bulleted_list_item", props: {} } as const;

    it("turns selected blocks into a list in one step, keeping the selection", () => {
      seed([p("a", "one"), p("b", "two"), p("c", "three")]);
      editor.selectBlocks({ anchor: "a", focus: "c" });
      editor.turnInto(bulleted);
      expect(outline()).toEqual(["bulleted_list_item:one", "bulleted_list_item:two", "bulleted_list_item:three"]);
      expect(editor.blocks).toEqual({ anchor: "a", focus: "c" });
      editor.undo();
      expect(outline()).toEqual(["paragraph:one", "paragraph:two", "paragraph:three"]);
    });

    it("turns the caret's block, keeping the caret", () => {
      seed([p("a", "Intro")]);
      editor.setSelection(caret("a", 2));
      editor.turnInto({ type: "heading", props: { level: 2 } });
      expect(outline()).toEqual(["heading:Intro"]);
      expect(editor.state.blocks.a!.props).toEqual({ level: 2 });
      expect(editor.selection).toEqual(caret("a", 2));
    });

    it("skips blocks without text, and changes only the selected blocks, not their children", () => {
      seed([p("a", "one", [p("c", "child")]), { id: "d", type: "divider" }, p("b", "two")]);
      editor.selectBlocks({ anchor: "a", focus: "b" });
      editor.turnInto({ type: "todo", props: { checked: false } });
      expect(outline()).toEqual(["todo:one", "  paragraph:child", "divider:", "todo:two"]);
    });

    it("turns the text blocks a range touches, keeping the range", () => {
      seed([p("a", "Hello"), p("b", "world")]);
      range("a", 2, "b", 3);
      editor.turnInto({ type: "heading", props: { level: 1 } });
      expect(outline()).toEqual(["heading:Hello", "heading:world"]);
      expect(editor.range).toEqual({ anchor: { blockId: "a", offset: 2 }, focus: { blockId: "b", offset: 3 } });
    });

    it("moves children out of blocks turned into code", () => {
      seed([p("a", "one", [p("c", "child")]), p("b", "two")]);
      editor.selectBlocks({ anchor: "a", focus: "b" });
      editor.turnInto({ type: "code", props: { language: "" } });
      expect(outline()).toEqual(["code:one", "paragraph:child", "code:two"]);
    });
  });

  describe("sub-pages from the slash menu", () => {
    const page = SLASH_COMMANDS.find((c) => c.value === "page")!;

    it("replaces an empty block with an empty sub-page, the caret before it, undone in one step", () => {
      seed([p("a", "Intro"), p("b", "/page")], { subPages: true });
      editor.setSelection(caret("b", 5));
      const id = editor.slash(0, page);
      expect(id).toBe("n1");
      expect(outline()).toEqual(["paragraph:Intro", "page:"]);
      expect(editor.selection).toEqual(caret("a", 5));
      editor.undo();
      expect(outline()).toEqual(["paragraph:Intro", "paragraph:/page"]);
    });

    it("follows a block with text", () => {
      seed([p("a", "See /page")], { subPages: true });
      editor.setSelection(caret("a", 9));
      editor.slash(4, page);
      expect(outline()).toEqual(["paragraph:See ", "page:"]);
    });

    it("does nothing where sub-pages can't be made", () => {
      seed([p("a", "/page")]);
      editor.setSelection(caret("a", 5));
      expect(editor.slash(0, page)).toBeNull();
      expect(outline()).toEqual(["paragraph:/page"]);
    });
  });

  describe("leaving the end of the page", () => {
    it("leaves a table for a new paragraph after it, from any cell", () => {
      seed([p("a", "A"), table("t")]);
      editor.setSelection(caret("t-b", 1));
      expect(editor.exitBlock()).toBe(true);
      expect(outline()).toEqual(["paragraph:A", "table:", "paragraph:"]);
      expect(editor.selection).toEqual(caret("n1", 0));
      editor.setSelection(caret("a", 0));
      expect(editor.exitBlock()).toBe(false);
    });

    it("adds a trailing paragraph when the page doesn't end with an empty one, else goes to it", () => {
      seed([p("a", "A"), table("t")]);
      editor.appendParagraph();
      expect(outline()).toEqual(["paragraph:A", "table:", "paragraph:"]);
      expect(editor.selection).toEqual(caret("n1", 0));
      editor.appendParagraph();
      expect(outline()).toEqual(["paragraph:A", "table:", "paragraph:"]);
      expect(editor.selection).toEqual(caret("n1", 0));
    });
  });

  describe("adding a block beside another", () => {
    it("adds a / paragraph after a table as a whole, in one undo step", () => {
      seed([p("a", "A"), table("t")]);
      editor.addBlock("t-a");
      expect(outline()).toEqual(["paragraph:A", "table:", "paragraph:/"]);
      expect(editor.selection).toEqual(caret("n1", 1));
      editor.undo();
      expect(outline()).toEqual(["paragraph:A", "table:"]);
    });

    it("adds before the block, at its level inside a toggle", () => {
      seed([toggle("g", "G", [p("c1", "one"), p("c2", "two")])]);
      editor.addBlock("c2", "before");
      expect(outline()).toEqual(["toggle:G", "  paragraph:one", "  paragraph:/", "  paragraph:two"]);
    });

    it("puts the / into an empty paragraph instead of adding one", () => {
      seed([p("a", "")]);
      editor.addBlock("a");
      expect(outline()).toEqual(["paragraph:/"]);
      expect(editor.selection).toEqual(caret("a", 1));
    });
  });

  describe("clipboard", () => {
    it("copies selected blocks whole, with their children", () => {
      seed([p("a", "Intro"), li("l1", "one"), toggle("g", "Toggle", [p("c", "inside")])]);
      editor.selectBlocks({ anchor: "l1", focus: "g" });
      expect(toMarkdown(blockTrees(editor.state, editor.selectedRoots()), reader)).toBe("- one\n\n▸ Toggle\n  inside");
    });

    it("pastes in place of selected blocks", () => {
      seed([p("a", "A"), p("b", "B"), p("c", "C")]);
      editor.selectBlocks({ anchor: "a", focus: "b" });
      editor.paste(md("- x\n- y"));
      expect(outline()).toEqual(["bulleted_list_item:x", "bulleted_list_item:y", "paragraph:C"]);
      editor.undo();
      expect(outline()).toEqual(["paragraph:A", "paragraph:B", "paragraph:C"]);
    });

    it("cuts a range and selected blocks after the clipboard is written", () => {
      seed([p("a", "Hello"), p("b", "world"), p("c", "C")]);
      range("a", 3, "b", 3);
      editor.removeSelection();
      expect(outline()).toEqual(["paragraph:Helld", "paragraph:C"]);
      editor.selectBlock("c");
      editor.removeSelection();
      expect(outline()).toEqual(["paragraph:Helld"]);
    });
  });
});
