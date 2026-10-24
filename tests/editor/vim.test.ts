import { beforeEach, describe, expect, it } from "vitest";

import { type AppServices, createInMemoryServices } from "~/composition";
import type { NewBlock, Operation } from "~/domain/blocks/types";
import { Editor } from "~/editor/editor";
import { arrowOrder, caret, type EditorState, getBlock, type Point, stateFromTree } from "~/editor/editor-state";
import { plain } from "~/editor/rich-text";
import { type ImageStop, LEADER_TIMEOUT_MS, Vim, type VimLayout, type VimMode } from "~/editor/vim";

type Seed = NewBlock & { children?: Seed[] };

/**
 * A layout where every block is one line, except code, whose lines are its
 * text lines; `j`/`k` keep the column as an offset.
 */
function fakeLayout(editor: Editor): VimLayout {
  let column: number | null = null;
  const value = (id: string) => plain(getBlock(editor.state, id).content);
  const line = ({ blockId, offset }: Point) => {
    const text = value(blockId);
    const start = text.lastIndexOf("\n", offset - 1) + 1;
    const end = text.indexOf("\n", offset);
    return { start, end: end < 0 ? text.length : end };
  };
  return {
    line,
    forgetColumn: () => (column = null),
    vertical(from, step) {
      const id = "image" in from ? from.image : from.blockId;
      if (!("image" in from)) {
        const here = line(from);
        column ??= from.offset - here.start;
        const text = value(id);
        // Another line in the same block first (code).
        if (step === 1 && here.end < text.length) {
          const next = line({ blockId: id, offset: here.end + 1 });
          return { blockId: id, offset: Math.min(next.start + column, next.end) };
        }
        if (step === -1 && here.start > 0) {
          const previous = line({ blockId: id, offset: here.start - 1 });
          return { blockId: id, offset: Math.min(previous.start + column, previous.end) };
        }
      }
      const order = arrowOrder(editor.state, editor.closed);
      const target = order[order.indexOf(id) + step];
      if (!target) return null;
      if (getBlock(editor.state, target).type === "image") return { image: target } satisfies ImageStop;
      const text = value(target);
      const edge = step === 1 ? line({ blockId: target, offset: 0 }) : line({ blockId: target, offset: text.length });
      return { blockId: target, offset: Math.min(edge.start + (column ?? 0), edge.end) };
    },
  };
}

describe("Vim mode", () => {
  let services: AppServices;
  let editor: Editor;
  let vim: Vim;
  let clock: number;
  let ids: number;
  let modes: VimMode[];
  let menus: { blockId: string; start: number }[];
  let copies: number;
  let helps: number;

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
      onOps: (batch) => services.blocks.apply(batch),
    });
    vim = new Vim(editor, fakeLayout(editor), {
      now: () => clock,
      newId: () => `v${++ids}`,
      onMode: (mode) => modes.push(mode),
      openMenu: (blockId, start) => menus.push({ blockId, start }),
      copy: () => copies++,
      help: () => helps++,
    });
  };

  const p = (id: string, value: string, children?: Seed[]): Seed => ({ id, type: "paragraph", content: [{ text: value }], ...(children ? { children } : {}) });
  const at = (blockId: string, offset: number) => editor.setSelection(caret(blockId, offset));
  /** Presses keys: each character is a key, `<Esc>` `<Space>` and `<C-r>` are named. */
  const keys = (sequence: string) => {
    for (const token of sequence.match(/<[^>]+>|./gsu) ?? []) {
      if (token === "<Esc>") vim.key("Escape");
      else if (token === "<Space>") vim.key(" ");
      else if (token === "<C-r>") vim.key("r", true);
      else if (vim.mode === "insert") {
        if (!vim.key(token)) editor.type(token);
      } else vim.key(token);
    }
  };
  /** The page's blocks as `type:text`, from the store. */
  const outline = (state?: EditorState) => {
    const s = state ?? stateFromTree(services.blocks.loadTree("page")!);
    const lines: string[] = [];
    const visit = (id: string, depth: number) => {
      for (const child of s.blocks[id]!.children) {
        const b = s.blocks[child]!;
        const checked = b.type === "todo" ? (b.props.checked ? "[x]" : "[ ]") : "";
        lines.push(`${"  ".repeat(depth)}${b.type}${checked}:${plain(b.content)}`);
        visit(child, depth + 1);
      }
    };
    visit(s.rootId, 0);
    return lines;
  };
  const cursor = () => ({ blockId: editor.selection.blockId, offset: editor.selection.focus });
  const expectInSync = () => expect(outline(editor.state)).toEqual(outline());

  beforeEach(() => {
    services = createInMemoryServices();
    clock = 0;
    ids = 0;
    modes = [];
    menus = [];
    copies = 0;
    helps = 0;
  });

  describe("Normal mode", () => {
    it("starts in Normal and never types", () => {
      seed([p("a", "Hello")]);
      at("a", 0);
      expect(vim.mode).toBe("normal");
      keys("qzQ!#");
      expect(outline()).toEqual(["paragraph:Hello"]);
    });

    it("rests on the last character, never after it", () => {
      seed([p("a", "Hello")]);
      at("a", 5);
      keys("l");
      expect(cursor()).toEqual({ blockId: "a", offset: 4 });
      keys("0$");
      expect(cursor()).toEqual({ blockId: "a", offset: 4 });
      keys("0llllllll");
      expect(cursor()).toEqual({ blockId: "a", offset: 4 });
    });

    it("moves by words with a count, and across blocks", () => {
      seed([p("a", "one two three four"), p("b", ""), p("c", "  five, six")]);
      at("a", 0);
      keys("3w");
      expect(cursor()).toEqual({ blockId: "a", offset: 14 });
      keys("w");
      expect(cursor()).toEqual({ blockId: "b", offset: 0 });
      keys("w");
      expect(cursor()).toEqual({ blockId: "c", offset: 2 });
      keys("ww");
      expect(cursor()).toEqual({ blockId: "c", offset: 8 });
      keys("e");
      expect(cursor()).toEqual({ blockId: "c", offset: 10 });
      keys("bbb");
      expect(cursor()).toEqual({ blockId: "c", offset: 2 });
      keys("b");
      expect(cursor()).toEqual({ blockId: "b", offset: 0 });
      keys("b");
      expect(cursor()).toEqual({ blockId: "a", offset: 14 });
    });

    it("goes to a line's start, first non-blank and end", () => {
      seed([p("a", "   indented text")]);
      at("a", 8);
      keys("0");
      expect(cursor().offset).toBe(0);
      keys("^");
      expect(cursor().offset).toBe(3);
      keys("$");
      expect(cursor().offset).toBe(15);
    });

    it("keeps gg and G in the cursor's block", () => {
      seed([p("a", "Before"), { id: "k", type: "code", content: [{ text: "one\ntwo\nthree" }] }, p("b", "After")]);
      at("k", 5);
      keys("G");
      expect(cursor()).toEqual({ blockId: "k", offset: 8 });
      keys("gg");
      expect(cursor()).toEqual({ blockId: "k", offset: 0 });
    });

    it("moves down and up between blocks keeping the column, and stops at images", () => {
      seed([
        p("a", "abcdef"),
        p("b", "uvwxyz"),
        { id: "img", type: "image", props: { url: "https://example.com/a.png", alt: "" } } as Seed,
        p("c", "after"),
      ]);
      at("a", 2);
      keys("j");
      expect(cursor()).toEqual({ blockId: "b", offset: 2 });
      keys("j");
      expect(editor.blocks).toEqual({ anchor: "img", focus: "img" });
      vim.fromImage("img", 1);
      expect(editor.blocks).toBeNull();
      expect(cursor()).toEqual({ blockId: "c", offset: 2 });
      keys("2k");
      expect(editor.blocks).toEqual({ anchor: "img", focus: "img" });
    });

    it("never moves up into the title, in Normal or Visual mode", () => {
      seed([p("a", "First"), p("b", "Second")]);
      at("b", 2);
      keys("5k");
      expect(cursor()).toEqual({ blockId: "a", offset: 2 });
      keys("k");
      expect(cursor()).toEqual({ blockId: "a", offset: 2 });
      keys("vk");
      expect(editor.selection).toEqual({ blockId: "a", anchor: 2, focus: 3 });
    });

    it("stays on an image at the top of the page on k", () => {
      seed([{ id: "img", type: "image", props: { url: "https://example.com/a.png", alt: "" } } as Seed, p("c", "After")]);
      editor.selectBlock("img");
      vim.fromImage("img", -1);
      expect(editor.blocks).toEqual({ anchor: "img", focus: "img" });
    });

    it("moves down the lines of a code block before leaving it", () => {
      seed([{ id: "k", type: "code", content: [{ text: "one\ntwo" }] }, p("b", "after")]);
      at("k", 1);
      keys("j");
      expect(cursor()).toEqual({ blockId: "k", offset: 5 });
      keys("j");
      expect(cursor()).toEqual({ blockId: "b", offset: 1 });
    });
  });

  describe("entering Insert", () => {
    it("enters Insert with i, a, I and A, and Esc goes back a character", () => {
      seed([p("a", "  Hello")]);
      at("a", 3);
      keys("i");
      expect(vim.mode).toBe("insert");
      expect(cursor().offset).toBe(3);
      keys("<Esc>");
      expect(vim.mode).toBe("normal");
      expect(cursor().offset).toBe(2);
      keys("a");
      expect(cursor().offset).toBe(3);
      keys("<Esc>I");
      expect(cursor().offset).toBe(2);
      keys("<Esc>A!<Esc>");
      expect(outline()).toEqual(["paragraph:  Hello!"]);
      expect(cursor().offset).toBe(7);
      expect(modes).toEqual(["insert", "normal", "insert", "normal", "insert", "normal", "insert", "normal"]);
    });

    it("doesn't go back before the line's start when leaving Insert", () => {
      seed([p("a", "Hello")]);
      at("a", 0);
      keys("i<Esc>");
      expect(cursor().offset).toBe(0);
    });

    it("opens a line after with o, continuing a list, and before with O", () => {
      seed([
        { id: "l", type: "bulleted_list_item", content: [{ text: "Item" }] },
        { id: "t", type: "todo", props: { checked: true }, content: [{ text: "Done" }] },
      ]);
      at("l", 1);
      keys("oNext<Esc>");
      expect(outline()).toEqual(["bulleted_list_item:Item", "bulleted_list_item:Next", "todo[x]:Done"]);
      at("t", 0);
      keys("o");
      expect(outline()).toEqual(["bulleted_list_item:Item", "bulleted_list_item:Next", "todo[x]:Done", "todo[ ]:"]);
      keys("<Esc>k");
      keys("O");
      expect(vim.mode).toBe("insert");
      expect(outline()).toEqual(["bulleted_list_item:Item", "bulleted_list_item:Next", "todo[ ]:", "todo[x]:Done", "todo[ ]:"]);
      expectInSync();
    });

    it("opens a new line inside code", () => {
      seed([{ id: "k", type: "code", content: [{ text: "one\ntwo" }] }]);
      at("k", 1);
      keys("ozero<Esc>");
      expect(outline()).toEqual(["code:one\nzero\ntwo"]);
      keys("Ofirst");
      expect(outline()).toEqual(["code:one\nfirst\nzero\ntwo"]);
    });
  });

  describe("operators", () => {
    it("deletes characters with x and a count, within the block", () => {
      seed([p("a", "abcdef"), p("b", "next")]);
      at("a", 0);
      keys("3x");
      expect(outline()).toEqual(["paragraph:def", "paragraph:next"]);
      keys("$5x");
      expect(outline()).toEqual(["paragraph:de", "paragraph:next"]);
      expect(cursor()).toEqual({ blockId: "a", offset: 1 });
    });

    it("deletes to the next word and to the line's end", () => {
      seed([p("a", "one two three")]);
      at("a", 0);
      keys("dw");
      expect(outline()).toEqual(["paragraph:two three"]);
      keys("wd$");
      expect(outline()).toEqual(["paragraph:two "]);
      expect(cursor().offset).toBe(3);
    });

    it("changes a word with cw and a block's text with cc", () => {
      seed([p("a", "old value"), p("b", "replace me")]);
      at("a", 0);
      keys("cwnew");
      expect(outline()).toEqual(["paragraph:new value", "paragraph:replace me"]);
      expect(vim.mode).toBe("insert");
      keys("<Esc>j");
      keys("ccfresh<Esc>");
      expect(outline()).toEqual(["paragraph:new value", "paragraph:fresh"]);
    });

    it("deletes blocks with dd, going to the block after, and before at the end", () => {
      seed([p("a", "First"), p("b", "Second"), p("c", "Third")]);
      at("b", 2);
      keys("dd");
      expect(outline()).toEqual(["paragraph:First", "paragraph:Third"]);
      expect(cursor()).toEqual({ blockId: "c", offset: 0 });
      keys("dd");
      expect(outline()).toEqual(["paragraph:First"]);
      expect(cursor().blockId).toBe("a");
      keys("u");
      expect(outline()).toEqual(["paragraph:First", "paragraph:Third"]);
      expectInSync();
    });

    it("deletes several blocks with a count, never sub-pages", () => {
      seed([p("a", "One"), { id: "sub", type: "page", content: [{ text: "Sub" }] }, p("b", "Two"), p("c", "Three")]);
      at("a", 0);
      keys("3dd");
      expect(outline()).toEqual(["page:Sub", "paragraph:Three"]);
      expect(editor.blocks).toBeNull();
    });

    it("duplicates a block with yy and p, one undo step", () => {
      seed([{ id: "t", type: "todo", props: { checked: false }, content: [{ text: "Buy milk" }] }, p("b", "Other")]);
      at("t", 3);
      keys("yy");
      expect(outline()).toEqual(["todo[ ]:Buy milk", "paragraph:Other"]);
      keys("p");
      expect(outline()).toEqual(["todo[ ]:Buy milk", "todo[ ]:Buy milk", "paragraph:Other"]);
      expect(cursor().blockId).not.toBe("t");
      keys("u");
      expect(outline()).toEqual(["todo[ ]:Buy milk", "paragraph:Other"]);
      keys("jP");
      expect(outline()).toEqual(["todo[ ]:Buy milk", "todo[ ]:Buy milk", "paragraph:Other"]);
      expectInSync();
    });

    it("pastes deleted text after or at the cursor", () => {
      seed([p("a", "abc")]);
      at("a", 0);
      keys("x");
      expect(outline()).toEqual(["paragraph:bc"]);
      keys("p");
      expect(outline()).toEqual(["paragraph:bac"]);
      expect(cursor().offset).toBe(1);
      keys("$P");
      expect(outline()).toEqual(["paragraph:baac"]);
    });

    it("undoes and redoes with u and Ctrl-r, back in Normal", () => {
      seed([p("a", "abcdef")]);
      at("a", 0);
      keys("x");
      keys("x");
      keys("2u");
      expect(outline()).toEqual(["paragraph:abcdef"]);
      keys("<C-r>");
      expect(outline()).toEqual(["paragraph:bcdef"]);
      expect(vim.mode).toBe("normal");
      expect(editor.range).toBeNull();
    });

    it("counts before the operator and before the motion multiply", () => {
      seed([p("a", "a b c d e f g")]);
      at("a", 0);
      keys("2d2w");
      expect(outline()).toEqual(["paragraph:e f g"]);
    });
  });

  describe("Visual mode", () => {
    it("selects from the character under the cursor and deletes it", () => {
      seed([p("a", "one two three")]);
      at("a", 4);
      keys("v");
      expect(vim.mode).toBe("visual");
      expect(editor.selection).toEqual({ blockId: "a", anchor: 4, focus: 5 });
      keys("e");
      expect(editor.selection).toEqual({ blockId: "a", anchor: 4, focus: 7 });
      keys("d");
      expect(outline()).toEqual(["paragraph:one  three"]);
      expect(vim.mode).toBe("normal");
    });

    it("selects backwards, including the character it started on", () => {
      seed([p("a", "one two")]);
      at("a", 5);
      keys("vb");
      expect(editor.selection).toEqual({ blockId: "a", anchor: 6, focus: 4 });
    });

    it("selects across blocks and joins them on d", () => {
      seed([p("a", "abcdef"), p("b", "uvwxyz")]);
      at("a", 2);
      keys("vjd");
      expect(outline()).toEqual(["paragraph:abxyz"]);
      expect(cursor()).toEqual({ blockId: "a", offset: 2 });
      expectInSync();
    });

    it("changes the selection with c, and yanks it with y (also to the clipboard)", () => {
      seed([p("a", "one two three")]);
      at("a", 4);
      keys("vey");
      expect(copies).toBe(1);
      expect(vim.mode).toBe("normal");
      expect(cursor().offset).toBe(4);
      keys("$p");
      expect(outline()).toEqual(["paragraph:one two threetwo"]);
      keys("0vecONE<Esc>");
      expect(outline()).toEqual(["paragraph:ONE two threetwo"]);
    });

    it("leaves with Esc or v, changing nothing", () => {
      seed([p("a", "one two")]);
      at("a", 0);
      keys("vw<Esc>");
      expect(vim.mode).toBe("normal");
      expect(editor.selection).toEqual(caret("a", 4));
      keys("vlv");
      expect(editor.selection).toEqual(caret("a", 5));
      expect(outline()).toEqual(["paragraph:one two"]);
    });
  });

  describe("the leader", () => {
    it("opens the slash or mention menu after the cursor's character, in Insert", () => {
      seed([p("a", "Hello")]);
      at("a", 4);
      keys("<Space>/");
      expect(outline()).toEqual(["paragraph:Hello/"]);
      expect(menus).toEqual([{ blockId: "a", start: 5 }]);
      expect(vim.mode).toBe("insert");
      keys("<Esc>");
      at("a", 0);
      keys("<Space>@");
      expect(outline()).toEqual(["paragraph:H@ello/"]);
      expect(menus.at(-1)).toEqual({ blockId: "a", start: 1 });
    });

    it("selects the block with Space then Esc", () => {
      seed([p("a", "Hello")]);
      at("a", 1);
      keys("<Space><Esc>");
      expect(editor.blocks).toEqual({ anchor: "a", focus: "a" });
    });

    it("does nothing after a second, or with another key", () => {
      seed([p("a", "Hello")]);
      at("a", 1);
      vim.key(" ");
      clock += LEADER_TIMEOUT_MS + 1;
      vim.key("/");
      expect(outline()).toEqual(["paragraph:Hello"]);
      expect(vim.mode).toBe("normal");
      keys("<Space>x");
      expect(outline()).toEqual(["paragraph:Hello"]);
      expect(cursor().offset).toBe(1);
    });
  });

  it("shows the list of keys with ? in Normal mode, not in Insert", () => {
    seed([p("a", "Hello")]);
    at("a", 0);
    keys("?");
    expect(helps).toBe(1);
    keys("i?");
    expect(helps).toBe(1);
    expect(outline()).toEqual(["paragraph:?Hello"]);
  });

  it("leaves Insert keys to the editor and Ctrl shortcuts in Normal mode", () => {
    seed([p("a", "Hello")]);
    at("a", 0);
    keys("i");
    expect(vim.key("x")).toBe(false);
    keys("<Esc>");
    expect(vim.key("b", true)).toBe(false);
    expect(vim.key("Escape")).toBe(true);
    expect(editor.blocks).toBeNull();
  });
});
