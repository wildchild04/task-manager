import { beforeEach, describe, expect, it } from "vitest";

import { type AppServices, createInMemoryServices } from "~/composition";
import type { NewBlock, Operation } from "~/domain/blocks/types";
import { matchSlashCommands, SLASH_COMMANDS } from "~/editor/block-types";
import { Editor } from "~/editor/editor";
import { arrowOrder, caret, documentOrder, type EditorState, stateFromTree } from "~/editor/editor-state";
import { plain } from "~/editor/rich-text";
import { verticalNeighbour } from "~/editor/tables";

type Seed = NewBlock & { children?: Seed[] };

/**
 * Each test edits a real page in the in-memory store: every batch the editor
 * emits is applied by the block service, and the stored tree must end up
 * equal to the editor's state.
 */
describe("editor", () => {
  let services: AppServices;
  let editor: Editor;
  let clock: number;
  let ids: number;

  const seed = (blocks: Seed[]) => {
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
      now: () => clock,
      onOps: (batch) => services.blocks.apply(batch),
    });
  };

  const p = (id: string, value: string, children?: Seed[]): Seed => ({ id, type: "paragraph", content: [{ text: value }], ...(children ? { children } : {}) });
  const at = (blockId: string, offset: number) => editor.setSelection(caret(blockId, offset));
  const typeText = (value: string) => [...value].forEach((ch) => editor.type(ch));

  /** The page as `type:text` lines, indented by depth, read from the store. */
  const outline = (state?: EditorState) => {
    const s = state ?? stateFromTree(services.blocks.loadTree("page")!);
    const lines: string[] = [];
    const visit = (id: string, depth: number) => {
      for (const child of s.blocks[id]!.children) {
        const b = s.blocks[child]!;
        const checked = b.type === "todo" ? (b.props.checked ? "[x]" : "[ ]") : "";
        const level = b.type === "heading" ? String(b.props.level) : "";
        lines.push(`${"  ".repeat(depth)}${b.type}${level}${checked}:${plain(b.content)}`);
        visit(child, depth + 1);
      }
    };
    visit(s.rootId, 0);
    return lines;
  };

  /** The store and the editor agree. */
  const expectInSync = () => {
    const stored = stateFromTree(services.blocks.loadTree("page")!);
    expect(outline(editor.state)).toEqual(outline(stored));
    for (const [id, block] of Object.entries(stored.blocks)) {
      expect(editor.state.blocks[id], id).toMatchObject({ type: block.type, content: block.content, children: block.children });
    }
  };

  beforeEach(() => {
    services = createInMemoryServices();
    clock = 0;
    ids = 0;
  });

  describe("typing", () => {
    it("types, deletes and replaces text, saving each change", () => {
      seed([p("a", "Hello world")]);
      at("a", 5);
      typeText(",");
      editor.setSelection({ blockId: "a", anchor: 7, focus: 12 });
      typeText("there");
      editor.deleteBackward();
      expect(outline()).toEqual(["paragraph:Hello, ther"]);
      expectInSync();
    });

    it("deletes whole words", () => {
      seed([p("a", "one two three")]);
      at("a", 13);
      editor.deleteBackward("word");
      at("a", 0);
      editor.deleteForward("word");
      expect(outline()).toEqual(["paragraph: two "]);
    });

    it("edits the title", () => {
      seed([]);
      at("page", 5);
      typeText("!");
      expect(plain(services.blocks.getBlock("page")!.content)).toBe("Title!");
    });

    it("toggles marks and links on a selection", () => {
      seed([p("a", "Hello world")]);
      editor.setSelection({ blockId: "a", anchor: 6, focus: 11 });
      editor.toggleMark("bold");
      editor.setLink("https://x.dev");
      expect(services.blocks.getBlock("a")!.content).toEqual([
        { text: "Hello " },
        { text: "world", marks: ["bold", { type: "link", href: "https://x.dev" }] },
      ]);
      expect(editor.toggleMark("italic")).toBe(true);
      at("a", 3);
      expect(editor.toggleMark("italic")).toBe(false);
    });
  });

  describe("Enter", () => {
    it("splits a paragraph at the caret", () => {
      seed([p("a", "Hello world")]);
      at("a", 6);
      editor.enter();
      expect(outline()).toEqual(["paragraph:Hello ", "paragraph:world"]);
      expect(editor.selection).toEqual(caret("n1", 0));
      expectInSync();
    });

    it("continues a heading as a paragraph, and a list as a list", () => {
      seed([
        { id: "h", type: "heading", props: { level: 2 }, content: [{ text: "Intro" }] },
        { id: "l", type: "bulleted_list_item", content: [{ text: "one" }] },
        { id: "t", type: "todo", props: { checked: true }, content: [{ text: "done" }] },
      ]);
      at("h", 5);
      editor.enter();
      at("l", 3);
      editor.enter();
      at("t", 4);
      editor.enter();
      expect(outline()).toEqual(["heading2:Intro", "paragraph:", "bulleted_list_item:one", "bulleted_list_item:", "todo[x]:done", "todo[ ]:"]);
      expectInSync();
    });

    it("leaves a list from an empty item", () => {
      seed([{ id: "l", type: "bulleted_list_item" }]);
      at("l", 0);
      editor.enter();
      expect(outline()).toEqual(["paragraph:"]);
    });

    it("inserts before a non-empty block when the caret is at its start, keeping the caret", () => {
      seed([p("a", "Text")]);
      at("a", 0);
      editor.enter();
      expect(outline()).toEqual(["paragraph:", "paragraph:Text"]);
      expect(editor.selection).toEqual(caret("a", 0));
      expectInSync();
    });

    it("keeps children with the original block", () => {
      seed([p("a", "Parent", [p("c", "Child")])]);
      at("a", 3);
      editor.enter();
      expect(outline()).toEqual(["paragraph:Par", "  paragraph:Child", "paragraph:ent"]);
      expectInSync();
    });

    it("opens an open toggle's first child, and follows a closed one", () => {
      seed([{ id: "t", type: "toggle", content: [{ text: "More" }], children: [p("c", "Inside")] }]);
      editor.toggleOpen("t");
      at("t", 4);
      editor.enter();
      expect(outline()).toEqual(["toggle:More", "  paragraph:", "  paragraph:Inside"]);
      editor.toggleOpen("t");
      at("t", 4);
      editor.enter();
      expect(outline()).toEqual(["toggle:More", "  paragraph:", "  paragraph:Inside", "paragraph:"]);
      expectInSync();
    });

    it("moves from the title to the first block, creating one in an empty page", () => {
      seed([]);
      at("page", 5);
      editor.enter();
      expect(outline()).toEqual(["paragraph:"]);
      expect(editor.selection).toEqual(caret("n1", 0));
      at("page", 2);
      editor.enter();
      expect(editor.selection).toEqual(caret("n1", 0));
      expect(outline()).toEqual(["paragraph:"]);
    });

    it("breaks a line inside the block with Shift+Enter", () => {
      seed([p("a", "ab")]);
      at("a", 1);
      editor.lineBreak();
      expect(outline()).toEqual(["paragraph:a\nb"]);
    });
  });

  describe("Backspace and Delete at edges", () => {
    it("merges paragraphs with the caret at the join", () => {
      seed([p("a", "Hello "), p("b", "world", [p("c", "child")])]);
      at("b", 0);
      editor.deleteBackward();
      expect(outline()).toEqual(["paragraph:Hello world", "  paragraph:child"]);
      expect(editor.selection).toEqual(caret("a", 6));
      expectInSync();
    });

    it("turns a list item, todo, heading or quote back into a paragraph first", () => {
      seed([p("a", "x"), { id: "q", type: "quote", content: [{ text: "Said" }] }]);
      at("q", 0);
      editor.deleteBackward();
      expect(outline()).toEqual(["paragraph:x", "paragraph:Said"]);
      editor.deleteBackward();
      expect(outline()).toEqual(["paragraph:xSaid"]);
    });

    it("un-nests a nested paragraph before merging", () => {
      seed([p("a", "Parent", [p("c", "Child")])]);
      at("c", 0);
      editor.deleteBackward();
      expect(outline()).toEqual(["paragraph:Parent", "paragraph:Child"]);
      expectInSync();
    });

    it("never deletes a sub-page: the caret steps over it", () => {
      seed([p("a", "Before"), { id: "sub", type: "page", content: [{ text: "Sub" }] }, p("b", "After")]);
      at("b", 0);
      editor.deleteBackward();
      expect(outline()).toEqual(["paragraph:Before", "page:Sub", "paragraph:After"]);
      expect(editor.selection).toEqual(caret("a", 6));
    });

    it("removes a reference or divider before the caret", () => {
      seed([p("a", "x"), { id: "r", type: "reference", props: { targetId: "a" } }, { id: "d", type: "divider" }, p("b", "y")]);
      at("b", 0);
      editor.deleteBackward();
      expect(outline()).toEqual(["paragraph:x", "reference:", "paragraph:y"]);
      editor.deleteBackward();
      expect(outline()).toEqual(["paragraph:x", "paragraph:y"]);
      expect(editor.selection).toEqual(caret("b", 0));
      expectInSync();
    });

    it("removes an empty first block, handing the caret to the title", () => {
      seed([p("a", "")]);
      at("a", 0);
      editor.deleteBackward();
      expect(outline()).toEqual([]);
      expect(editor.selection).toEqual(caret("page", 5));
    });

    it("joins the next block with Delete at the end", () => {
      seed([p("a", "Hello "), p("b", "world")]);
      at("a", 6);
      editor.deleteForward();
      expect(outline()).toEqual(["paragraph:Hello world"]);
      expect(editor.selection).toEqual(caret("a", 6));
      expectInSync();
    });
  });

  describe("nesting", () => {
    it("indents under the previous sibling and refuses the first block", () => {
      seed([
        { id: "a", type: "bulleted_list_item", content: [{ text: "one" }] },
        { id: "b", type: "bulleted_list_item", content: [{ text: "two" }] },
      ]);
      at("a", 0);
      expect(editor.indent()).toBe(false);
      at("b", 1);
      editor.indent();
      expect(outline()).toEqual(["bulleted_list_item:one", "  bulleted_list_item:two"]);
      expect(editor.selection).toEqual(caret("b", 1));
      expectInSync();
    });

    it("doesn't nest under a divider", () => {
      seed([{ id: "d", type: "divider" }, p("a", "x")]);
      at("a", 0);
      expect(editor.indent()).toBe(false);
    });

    it("outdents, taking the following siblings as children", () => {
      seed([p("parent", "P", [p("a", "a"), p("b", "b"), p("c", "c")])]);
      at("a", 0);
      editor.outdent();
      expect(outline()).toEqual(["paragraph:P", "paragraph:a", "  paragraph:b", "  paragraph:c"]);
      expectInSync();
    });
  });

  describe("suggestions", () => {
    const suggestion = (id: string, children: Seed[]): Seed => ({ id, type: "suggestion", props: { action: "insert" }, children });

    it("leaves a suggestion's blocks out of the text being edited", () => {
      seed([p("a", "Before"), suggestion("s", [p("in", "Proposed")]), p("b", "After")]);
      expect(documentOrder(editor.state)).toEqual(["a", "s", "b"]);
    });

    it("steps over a suggestion with Backspace and Delete, keeping it", () => {
      seed([p("a", "Before"), suggestion("s", [p("in", "Proposed")]), p("b", "After")]);
      at("b", 0);
      editor.deleteBackward();
      expect(editor.selection).toEqual(caret("a", 6));
      editor.deleteForward();
      expect(outline()).toEqual(["paragraph:Before", "suggestion:", "  paragraph:Proposed", "paragraph:After"]);
    });

    it("doesn't nest into a suggestion, and outdents past one as a whole", () => {
      seed([suggestion("s", [p("in", "Proposed")]), p("a", "x"), p("parent", "P", [p("c", "c"), suggestion("s2", [p("in2", "y")])])]);
      at("a", 0);
      expect(editor.indent()).toBe(false);
      at("c", 0);
      editor.outdent();
      expect(outline().slice(-4)).toEqual(["paragraph:P", "paragraph:c", "  suggestion:", "    paragraph:y"]);
      expectInSync();
    });
  });

  describe("images", () => {
    const SHOT = { contentId: `${"ab".repeat(32)}.png`, alt: "" };
    const CHART = { url: "https://x.dev/chart.png", alt: "Chart" };
    const image = (id: string, props: Record<string, unknown> = SHOT): Seed => ({ id, type: "image", props });

    it("replaces an empty paragraph, with an empty paragraph after holding the caret", () => {
      seed([p("a", "")]);
      at("a", 0);
      expect(editor.insertImages("a", [SHOT])).toBe(true);
      expect(outline()).toEqual(["image:", "paragraph:"]);
      expect(editor.selection).toEqual(caret("n2", 0));
      expectInSync();
    });

    it("follows a paragraph with text, in order, the caret going to the text block after; one undo removes them", () => {
      seed([p("a", "See below"), p("b", "After")]);
      at("a", 3);
      editor.insertImages("a", [SHOT, CHART]);
      expect(outline()).toEqual(["paragraph:See below", "image:", "image:", "paragraph:After"]);
      expect(services.blocks.getChildren("page")[2]).toMatchObject({ props: CHART });
      expect(editor.selection).toEqual(caret("b", 0));
      editor.undo();
      expect(outline()).toEqual(["paragraph:See below", "paragraph:After"]);
      expectInSync();
    });

    it("goes first on the page from the title", () => {
      seed([p("a", "x")]);
      editor.insertImages("page", [CHART]);
      expect(outline()).toEqual(["image:", "paragraph:x"]);
      expect(editor.selection).toEqual(caret("a", 0));
    });

    it("selects an image with Backspace after it and Delete before it; a second press deletes it", () => {
      seed([p("a", "Before"), image("i"), p("b", "After")]);
      at("b", 0);
      editor.deleteBackward();
      expect(editor.blocks).toEqual({ anchor: "i", focus: "i" });
      expect(outline()).toEqual(["paragraph:Before", "image:", "paragraph:After"]);
      at("a", 6);
      editor.deleteForward();
      expect(editor.blocks).toEqual({ anchor: "i", focus: "i" });
      editor.deleteBackward();
      expect(outline()).toEqual(["paragraph:Before", "paragraph:After"]);
      expect(editor.selection).toEqual(caret("a", 6));
      editor.undo();
      expect(documentOrder(editor.state)).toEqual(["a", "i", "b"]);
      expectInSync();
    });

    it("removes an empty paragraph after an image with Backspace, selecting the image", () => {
      seed([p("a", "Before"), image("i"), p("b", "")]);
      at("b", 0);
      editor.deleteBackward();
      expect(outline()).toEqual(["paragraph:Before", "image:"]);
      expect(editor.blocks).toEqual({ anchor: "i", focus: "i" });
      expectInSync();
    });

    it("stops the arrow keys at images", () => {
      seed([p("a", "x"), image("i"), { id: "d", type: "divider" }, p("b", "y")]);
      expect(arrowOrder(editor.state)).toEqual(["page", "a", "i", "b"]);
    });

    it("doesn't nest under an image", () => {
      seed([image("i"), p("a", "x")]);
      at("a", 0);
      expect(editor.indent()).toBe(false);
    });

    it("sets alt text as one undo step", () => {
      seed([image("i", CHART), p("a", "")]);
      at("a", 0);
      expect(editor.setImageAlt("i", "  Server rack, front view ")).toBe(true);
      expect(services.blocks.getBlock("i")!.props).toEqual({ url: CHART.url, alt: "Server rack, front view" });
      expect(editor.setImageAlt("i", "Server rack, front view")).toBe(false);
      editor.undo();
      expect(services.blocks.getBlock("i")!.props).toEqual(CHART);
      expectInSync();
    });
  });

  describe("tables", () => {
    const cell = (id: string, value = ""): Seed => ({ id, type: "table_cell", content: value ? [{ text: value }] : [] });
    /** T: a 2×2 table, rows r1 [a, b] and r2 [c, d], between paragraphs "Before" and "After". */
    const seedTable = () =>
      seed([
        p("x", "Before"),
        {
          id: "T",
          type: "table",
          props: { headerRow: true, headerColumn: false },
          children: [
            { id: "r1", type: "table_row", children: [cell("a", "A"), cell("b", "B")] },
            { id: "r2", type: "table_row", children: [cell("c", "C"), cell("d", "D")] },
          ],
        },
        p("y", "After"),
      ]);
    const grid = () =>
      getBlockIds("T").map((row) => getBlockIds(row).map((id) => plain(services.blocks.getBlock(id)!.content)));
    const getBlockIds = (id: string) => services.blocks.getChildren(id).map((b) => b.id);

    it("moves through cells with Tab and Shift+Tab, adding a row from the last cell", () => {
      seedTable();
      at("a", 1);
      editor.tab();
      expect(editor.selection).toEqual(caret("b", 0));
      editor.tab();
      expect(editor.selection).toEqual(caret("c", 0));
      editor.tab(true);
      expect(editor.selection).toEqual(caret("b", 0));
      at("d", 1);
      editor.tab();
      expect(grid()).toEqual([["A", "B"], ["C", "D"], ["", ""]]);
      expect(editor.selection).toEqual(caret(getBlockIds(getBlockIds("T")[2]!)[0]!, 0));
      expectInSync();
    });

    it("moves down with Enter without splitting, adding a row from the last row; Shift+Enter breaks a line", () => {
      seedTable();
      at("b", 1);
      editor.enter();
      expect(editor.selection).toEqual(caret("d", 0));
      expect(grid()).toEqual([["A", "B"], ["C", "D"]]);
      editor.enter();
      expect(grid()).toEqual([["A", "B"], ["C", "D"], ["", ""]]);
      expect(editor.selection).toEqual(caret(getBlockIds(getBlockIds("T")[2]!)[1]!, 0));
      at("a", 1);
      editor.lineBreak();
      expect(grid()[0]).toEqual(["A\n", "B"]);
      expectInSync();
    });

    it("never merges at a cell's edges, steps over the table with Backspace, and doesn't nest into it", () => {
      seedTable();
      at("c", 0);
      editor.deleteBackward();
      at("a", 1);
      editor.deleteForward();
      expect(grid()).toEqual([["A", "B"], ["C", "D"]]);
      at("y", 0);
      editor.deleteBackward();
      expect(editor.selection).toEqual(caret("d", 1));
      expect(outline()).toContain("paragraph:After");
      expect(editor.indent()).toBe(false);
      at("x", 6);
      editor.deleteForward();
      expect(outline()[0]).toBe("paragraph:Before");
    });

    it("moves by column with ↑ and ↓, leaving the table from its first or last row", () => {
      seedTable();
      expect(verticalNeighbour(editor.state, "b", false)).toBe("d");
      expect(verticalNeighbour(editor.state, "d", true)).toBe("b");
      expect(verticalNeighbour(editor.state, "a", true)).toBe("x");
      expect(verticalNeighbour(editor.state, "c", false)).toBe("y");
    });

    it("stops at an image when leaving the table", () => {
      const row = (id: string, cells: string[]): Seed => ({ id, type: "table_row", children: cells.map((c) => cell(c)) });
      seed([
        { id: "I1", type: "image", props: { url: "https://example.com/a.png" } },
        { id: "T", type: "table", props: { headerRow: false, headerColumn: false }, children: [row("r1", ["a"]), row("r2", ["c"])] },
        { id: "I2", type: "image", props: { url: "https://example.com/b.png" } },
        p("y", ""),
      ]);
      expect(verticalNeighbour(editor.state, "c", false)).toBe("I2");
      expect(verticalNeighbour(editor.state, "a", true)).toBe("I1");
    });

    it("adds, moves and deletes rows and columns as single undo steps", () => {
      seedTable();
      at("a", 0);
      editor.addTableColumn("T");
      expect(grid()).toEqual([["A", "B", ""], ["C", "D", ""]]);
      editor.undo();
      expect(grid()).toEqual([["A", "B"], ["C", "D"]]);
      editor.addTableColumn("T", { column: 0, side: "before" });
      expect(grid()).toEqual([["", "A", "B"], ["", "C", "D"]]);
      editor.undo();
      editor.addTableRow("T", { rowId: "r1", side: "before" });
      expect(grid()).toEqual([["", ""], ["A", "B"], ["C", "D"]]);
      editor.undo();
      editor.moveTableRow("r2", -1);
      expect(grid()).toEqual([["C", "D"], ["A", "B"]]);
      expect(editor.moveTableRow("r2", -1)).toBe(false);
      editor.moveTableColumn("T", 0, 1);
      expect(grid()).toEqual([["D", "C"], ["B", "A"]]);
      editor.undo();
      editor.undo();
      at("c", 0);
      editor.deleteTableRow("r2");
      expect(grid()).toEqual([["A", "B"]]);
      expect(editor.selection).toEqual(caret("a", 0));
      expect(editor.deleteTableRow("r1")).toBe(false);
      editor.deleteTableColumn("T", 0);
      expect(grid()).toEqual([["B"]]);
      expect(editor.deleteTableColumn("T", 0)).toBe(false);
      expectInSync();
    });

    it("toggles headers, and deletes the table, the caret going before it", () => {
      seedTable();
      editor.toggleTableHeader("T", "headerColumn");
      editor.toggleTableHeader("T", "headerRow");
      expect(services.blocks.getBlock("T")!.props).toEqual({ headerRow: false, headerColumn: true });
      at("c", 1);
      editor.deleteTable("T");
      expect(outline()).toEqual(["paragraph:Before", "paragraph:After"]);
      expect(editor.selection).toEqual(caret("x", 6));
      editor.undo();
      expect(grid()).toEqual([["A", "B"], ["C", "D"]]);
      expectInSync();
    });

    it("makes a 3×3 table with a header row from the slash menu", () => {
      seed([p("e", ""), p("f", "Notes")]);
      at("e", 0);
      typeText("/table");
      editor.slash(0, SLASH_COMMANDS.find((c) => c.value === "table")!);
      const table = services.blocks.getChildren("page")[0]!;
      expect(table).toMatchObject({ type: "table", props: { headerRow: true, headerColumn: false } });
      expect(getBlockIds(table.id).map((row) => getBlockIds(row).length)).toEqual([3, 3, 3]);
      expect(editor.selection).toEqual(caret(getBlockIds(getBlockIds(table.id)[0]!)[0]!, 0));
      expect(services.blocks.getBlock("e")).toBeUndefined();
      at("f", 5);
      typeText(" /table");
      editor.slash(6, SLASH_COMMANDS.find((c) => c.value === "table")!);
      expect(services.blocks.getChildren("page").map((b) => b.type)).toEqual(["table", "paragraph", "table"]);
      expect(plain(services.blocks.getBlock("f")!.content)).toBe("Notes ");
      expectInSync();
    });
  });

  describe("code blocks", () => {
    it("becomes code from ``` and a language with Enter", () => {
      seed([p("a", "")]);
      at("a", 0);
      typeText("```ts");
      editor.enter();
      expect(services.blocks.getBlock("a")).toMatchObject({ type: "code", props: { language: "ts" }, content: [] });
      expect(editor.selection).toEqual(caret("a", 0));
    });

    it("adds lines with Enter, indents with Tab and Shift+Tab, and leaves with exitBlock", () => {
      seed([{ id: "k", type: "code", props: { language: "sh" }, content: [{ text: "echo" }] }]);
      at("k", 4);
      editor.enter();
      editor.tab();
      typeText("ls");
      expect(plain(services.blocks.getBlock("k")!.content)).toBe("echo\n  ls");
      editor.tab(true);
      expect(plain(services.blocks.getBlock("k")!.content)).toBe("echo\nls");
      expect(editor.selection).toEqual(caret("k", 7));
      editor.exitBlock();
      expect(outline()).toEqual(["code:echo\nls", "paragraph:"]);
      expectInSync();
    });

    it("keeps marks and links out, and becomes a paragraph with Backspace only when empty", () => {
      seed([{ id: "k", type: "code", content: [{ text: "x" }] }]);
      editor.setSelection({ blockId: "k", anchor: 0, focus: 1 });
      expect(editor.toggleMark("bold")).toBe(false);
      expect(editor.setLink("https://example.com")).toBe(false);
      at("k", 0);
      editor.deleteBackward();
      expect(services.blocks.getBlock("k")!.type).toBe("code");
      at("k", 1);
      editor.deleteBackward();
      editor.deleteBackward();
      expect(services.blocks.getBlock("k")!.type).toBe("paragraph");
    });

    it("turns a block into plain code from the slash menu, its children moving out after it", () => {
      seed([p("a", "", [p("child", "Inside")])]);
      services.blocks.apply([{ op: "update", id: "a", content: [{ text: "x" }, { text: "y", marks: ["bold"] }] }]);
      editor.reset(stateFromTree(services.blocks.loadTree("page")!));
      at("a", 0);
      typeText("/code");
      editor.slash(0, SLASH_COMMANDS.find((c) => c.value === "code")!);
      expect(services.blocks.getBlock("a")).toMatchObject({ type: "code", content: [{ text: "xy" }] });
      expect(outline()).toEqual(["code:xy", "paragraph:Inside"]);
      expectInSync();
    });

    it("joins a following paragraph as plain text, and sets its language", () => {
      seed([{ id: "k", type: "code", content: [{ text: "a" }] }, { id: "b", type: "paragraph", content: [{ text: "b", marks: ["bold"] }] }]);
      at("b", 0);
      editor.deleteBackward();
      expect(services.blocks.getBlock("k")!.content).toEqual([{ text: "ab" }]);
      editor.setCodeLanguage("k", "python");
      expect(services.blocks.getBlock("k")!.props).toEqual({ language: "python" });
    });
  });

  describe("headings 4–6 and callouts", () => {
    it("makes headings 4 to 6 with #### to ######", () => {
      seed([p("a", "Glossary"), p("b", ""), p("c", "")]);
      at("a", 0);
      typeText("#### ");
      at("b", 0);
      typeText("##### ");
      at("c", 0);
      typeText("###### ");
      expect(outline()).toEqual(["heading4:Glossary", "heading5:", "heading6:"]);
    });

    it("makes a callout, continues after it with Enter, and changes its emoji and tone in one step each", () => {
      seed([p("a", "Careful")]);
      at("a", 0);
      typeText("/call");
      editor.slash(0, SLASH_COMMANDS.find((c) => c.value === "callout")!);
      expect(services.blocks.getBlock("a")).toMatchObject({ type: "callout", props: { emoji: "💡", tone: "default" } });
      at("a", 7);
      editor.enter();
      expect(outline()).toEqual(["callout:Careful", "paragraph:"]);
      editor.setCalloutStyle("a", { tone: "warning" });
      editor.setCalloutStyle("a", { emoji: "⚠️" });
      expect(services.blocks.getBlock("a")!.props).toEqual({ emoji: "⚠️", tone: "warning" });
      editor.undo();
      expect(services.blocks.getBlock("a")!.props).toEqual({ emoji: "💡", tone: "warning" });
      expectInSync();
    });
  });

  describe("markdown shortcuts", () => {
    it.each([
      ["# ", "heading1:"],
      ["## ", "heading2:"],
      ["### ", "heading3:"],
      ["- ", "bulleted_list_item:"],
      ["* ", "bulleted_list_item:"],
      ["1. ", "numbered_list_item:"],
      ["[] ", "todo[ ]:"],
      ["> ", "quote:"],
    ])("%j changes the type", (typed, line) => {
      seed([p("a", "")]);
      at("a", 0);
      typeText(typed);
      expect(outline()).toEqual([line]);
      expectInSync();
    });

    it("keeps the rest of the text", () => {
      seed([p("a", "Title")]);
      at("a", 0);
      typeText("# ");
      expect(outline()).toEqual(["heading1:Title"]);
    });

    it("turns --- into a divider followed by a paragraph", () => {
      seed([p("a", "")]);
      at("a", 0);
      typeText("---");
      expect(outline()).toEqual(["divider:", "paragraph:"]);
      expect(editor.selection.blockId).toBe(documentOrder(editor.state)[1]);
      expectInSync();
    });

    it("undoes a shortcut back to the typed characters", () => {
      seed([p("a", "")]);
      at("a", 0);
      typeText("- ");
      editor.undo();
      expect(outline()).toEqual(["paragraph:- "]);
      expectInSync();
    });

    it("ignores shortcut text that isn't at the start, or in other types", () => {
      seed([p("a", "x"), { id: "q", type: "quote" }]);
      at("a", 1);
      typeText("# ");
      at("q", 0);
      typeText("- ");
      expect(outline()).toEqual(["paragraph:x# ", "quote:- "]);
    });
  });

  describe("slash commands", () => {
    const command = (value: string) => SLASH_COMMANDS.find((c) => c.value === value)!;

    it("filters by name and keyword", () => {
      expect(matchSlashCommands("hea").map((c) => c.value)).toEqual(["heading-1", "heading-2", "heading-3", "heading-4", "heading-5", "heading-6"]);
      expect(matchSlashCommands("tab").map((c) => c.value)).toEqual(["table"]);
      expect(matchSlashCommands("check").map((c) => c.value)).toEqual(["todo"]);
      expect(matchSlashCommands("list").map((c) => c.value)).toEqual(["bulleted", "numbered"]);
      expect(matchSlashCommands("")).toHaveLength(SLASH_COMMANDS.length - 1);
      expect(matchSlashCommands("", { subPages: true })).toHaveLength(SLASH_COMMANDS.length);
      expect(matchSlashCommands("pa").map((c) => c.value)).toEqual(["text"]);
      expect(matchSlashCommands("pa", { subPages: true }).map((c) => c.value)).toEqual(["text", "page"]);
      expect(matchSlashCommands("zzz")).toEqual([]);
    });

    it("removes the typed command and turns the block into the type, keeping its text", () => {
      seed([p("a", "Intro")]);
      at("a", 0);
      typeText("/hea");
      editor.slash(0, command("heading-1"));
      expect(outline()).toEqual(["heading1:Intro"]);
      expect(editor.selection).toEqual(caret("a", 0));
      expectInSync();
    });

    it("replaces an empty block with a divider and a paragraph", () => {
      seed([p("a", "")]);
      at("a", 0);
      typeText("/div");
      editor.slash(0, command("divider"));
      expect(outline()).toEqual(["divider:", "paragraph:"]);
      expectInSync();
    });

    it("adds a divider after a block with text", () => {
      seed([p("a", "Keep ")]);
      at("a", 5);
      typeText("/div");
      editor.slash(5, command("divider"));
      expect(outline()).toEqual(["paragraph:Keep ", "divider:"]);
      expect(editor.selection).toEqual(caret("a", 5));
    });

    it("undoes a command in one step, back to the typed text", () => {
      seed([p("a", "")]);
      at("a", 0);
      typeText("/todo");
      clock = 5000;
      editor.slash(0, command("todo"));
      editor.undo();
      expect(outline()).toEqual(["paragraph:/todo"]);
      expectInSync();
    });
  });

  describe("mentions", () => {
    const m = (pageId: string) => ({ text: "\uFFFC", mention: { pageId } });
    const seedWithTarget = (blocks: Seed[]) => {
      services.blocks.apply([{ op: "insert", block: { id: "arch", type: "page", content: [{ text: "Architecture" }] }, parentId: null }]);
      seed(blocks);
    };

    it("turns a typed @query into a mention and a space, as one undo step", () => {
      seedWithTarget([p("a", "See ")]);
      at("a", 4);
      typeText("@arch");
      clock = 5000;
      editor.mention(4, "arch");
      expect(services.blocks.getBlock("a")!.content).toEqual([{ text: "See " }, m("arch"), { text: " " }]);
      expect(editor.selection).toEqual(caret("a", 6));
      editor.undo();
      expect(services.blocks.getBlock("a")!.content).toEqual([{ text: "See @arch" }]);
      expectInSync();
    });

    it("deletes a mention whole with Backspace or Delete", () => {
      seedWithTarget([{ id: "a", type: "paragraph", content: [{ text: "x" }, m("arch"), { text: "y" }] }]);
      at("a", 2);
      editor.deleteBackward();
      expect(services.blocks.getBlock("a")!.content).toEqual([{ text: "xy" }]);
      editor.undo();
      at("a", 1);
      editor.deleteForward();
      expect(services.blocks.getBlock("a")!.content).toEqual([{ text: "xy" }]);
      expectInSync();
    });

    it("undoes deleting a mention on its own, without the typing just before", () => {
      seedWithTarget([{ id: "a", type: "paragraph", content: [{ text: "x" }, m("arch")] }]);
      at("a", 2);
      typeText("yz");
      editor.deleteBackward();
      editor.deleteBackward();
      editor.deleteBackward();
      expect(services.blocks.getBlock("a")!.content).toEqual([{ text: "x" }]);
      editor.undo();
      expect(services.blocks.getBlock("a")!.content).toEqual([{ text: "x" }, m("arch")]);
    });

    it("keeps a mention through splitting and merging blocks", () => {
      seedWithTarget([{ id: "a", type: "paragraph", content: [{ text: "x" }, m("arch"), { text: "y" }] }]);
      at("a", 2);
      editor.enter();
      expect(services.blocks.getBlock("a")!.content).toEqual([{ text: "x" }, m("arch")]);
      editor.deleteBackward();
      expect(services.blocks.getBlock("a")!.content).toEqual([{ text: "x" }, m("arch"), { text: "y" }]);
      expectInSync();
    });
  });

  describe("toggles start folded", () => {
    it("folds the toggles a page loads with, and opens toggles created while editing", () => {
      seed([{ id: "t", type: "toggle", content: [{ text: "Loaded" }] }, p("a", "")]);
      expect(editor.closed.has("t")).toBe(true);
      at("a", 0);
      typeText("/tog");
      editor.slash(0, SLASH_COMMANDS.find((c) => c.value === "toggle")!);
      expect(editor.closed.has("a")).toBe(false);
      typeText("New");
      editor.enter();
      expect(outline()).toEqual(["toggle:Loaded", "toggle:New", "  paragraph:"]);
    });
  });

  describe("type functions", () => {
    it("checks a todo", () => {
      seed([{ id: "t", type: "todo", content: [{ text: "Do it" }] }]);
      editor.toggleTodo("t");
      expect(services.blocks.getBlock("t")!.props).toEqual({ checked: true });
    });

    it("moves the caret out of a toggle that closes, without saving anything", () => {
      seed([{ id: "t", type: "toggle", content: [{ text: "More" }], children: [p("c", "Inside")] }]);
      editor.toggleOpen("t");
      at("c", 2);
      editor.toggleOpen("t");
      expect(editor.selection).toEqual(caret("t", 0));
      expect(editor.closed.has("t")).toBe(true);
    });
  });

  describe("reset to newer content", () => {
    const reload = () => editor.reset(stateFromTree(services.blocks.loadTree("page")!));

    it("keeps the caret in its block when content is added elsewhere", () => {
      seed([p("a", "First"), p("b", "Second")]);
      at("b", 3);
      services.blocks.apply([{ op: "insert", block: { id: "c", type: "paragraph", content: [{ text: "Third" }] }, parentId: "page", afterId: "b" }]);
      reload();
      expect(editor.selection).toEqual(caret("b", 3));
      expect(outline()).toEqual(["paragraph:First", "paragraph:Second", "paragraph:Third"]);
    });

    it("clamps the caret and selected text to the block's new length", () => {
      seed([p("a", "First"), p("b", "Second")]);
      editor.setSelection({ blockId: "b", anchor: 2, focus: 6 });
      services.blocks.apply([{ op: "update", id: "b", content: [{ text: "Sec" }] }]);
      reload();
      expect(editor.selection).toEqual({ blockId: "b", anchor: 2, focus: 3 });
      editor.setRange({ anchor: { blockId: "a", offset: 1 }, focus: { blockId: "b", offset: 3 } });
      services.blocks.apply([{ op: "update", id: "b", content: [{ text: "S" }] }]);
      reload();
      expect(editor.range).toEqual({ anchor: { blockId: "a", offset: 1 }, focus: { blockId: "b", offset: 1 } });
    });

    it("moves the caret to the title when its block is gone, and starts the undo history afresh", () => {
      seed([p("a", "First"), p("b", "Second")]);
      at("b", 6);
      typeText("!");
      services.blocks.apply([{ op: "delete", id: "b" }]);
      reload();
      expect(editor.selection).toEqual(caret("page", 0));
      editor.undo();
      expect(outline()).toEqual(["paragraph:First"]);
    });
  });

  describe("undo and redo", () => {
    it("undoes a burst of typing in one step, and a pause starts a new one", () => {
      seed([p("a", "")]);
      at("a", 0);
      typeText("abc");
      clock = 5000;
      typeText("d");
      editor.undo();
      expect(outline()).toEqual(["paragraph:abc"]);
      editor.undo();
      expect(outline()).toEqual(["paragraph:"]);
      editor.redo();
      expect(outline()).toEqual(["paragraph:abc"]);
      expect(editor.selection).toEqual(caret("a", 3));
      expectInSync();
    });

    it("undoes every structural edit, restoring the caret", () => {
      seed([p("a", "Hello world", [p("c", "child")]), { id: "d", type: "divider" }, p("b", "x")]);
      const before = outline();
      at("a", 6);
      editor.enter();
      at("b", 0);
      editor.deleteBackward();
      at("n1", 0);
      editor.deleteBackward();
      at("c", 0);
      editor.outdent();
      editor.indent();
      editor.toggleTodo("a");
      while (editor.undo());
      expect(outline()).toEqual(before);
      expect(editor.selection).toEqual(caret("a", 6));
      expectInSync();
      while (editor.redo());
      expectInSync();
    });

    it("restores a merged block with its children", () => {
      seed([p("a", "A"), p("b", "B", [p("c", "C", [p("g", "G")])])]);
      at("b", 0);
      editor.deleteBackward();
      editor.undo();
      expect(outline()).toEqual(["paragraph:A", "paragraph:B", "  paragraph:C", "    paragraph:G"]);
      expectInSync();
    });
  });
});
