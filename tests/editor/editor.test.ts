import { beforeEach, describe, expect, it } from "vitest";

import { type AppServices, createInMemoryServices } from "~/composition";
import type { NewBlock, Operation } from "~/domain/blocks/types";
import { matchSlashCommands, SLASH_COMMANDS } from "~/editor/block-types";
import { Editor } from "~/editor/editor";
import { caret, documentOrder, type EditorState, stateFromTree } from "~/editor/editor-state";
import { plain } from "~/editor/rich-text";

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
      expect(matchSlashCommands("hea").map((c) => c.value)).toEqual(["heading-1", "heading-2", "heading-3"]);
      expect(matchSlashCommands("check").map((c) => c.value)).toEqual(["todo"]);
      expect(matchSlashCommands("list").map((c) => c.value)).toEqual(["bulleted", "numbered"]);
      expect(matchSlashCommands("")).toHaveLength(SLASH_COMMANDS.length);
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

  describe("type functions", () => {
    it("checks a todo", () => {
      seed([{ id: "t", type: "todo", content: [{ text: "Do it" }] }]);
      editor.toggleTodo("t");
      expect(services.blocks.getBlock("t")!.props).toEqual({ checked: true });
    });

    it("moves the caret out of a toggle that closes, without saving anything", () => {
      seed([{ id: "t", type: "toggle", content: [{ text: "More" }], children: [p("c", "Inside")] }]);
      at("c", 2);
      editor.toggleOpen("t");
      expect(editor.selection).toEqual(caret("t", 0));
      expect(editor.closed.has("t")).toBe(true);
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
