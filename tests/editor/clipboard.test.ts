import { beforeEach, describe, expect, it } from "vitest";

import { type AppServices, createInMemoryServices } from "~/composition";
import { fromMarkdown, type MarkdownReader, toMarkdown } from "~/domain/blocks/markdown";
import type { NewBlock, Operation } from "~/domain/blocks/types";
import { selectedTrees } from "~/editor/clipboard";
import { Editor } from "~/editor/editor";
import { caret, type EditorState, stateFromTree } from "~/editor/editor-state";
import { plain } from "~/editor/rich-text";

type Seed = NewBlock & { children?: Seed[] };

const reader: MarkdownReader = {
  mentionTarget: () => null,
  referenceTarget: () => null,
  appLink: () => undefined,
  pageId: (id) => id,
};

describe("paste and copy", () => {
  let services: AppServices;
  let editor: Editor;
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
      now: () => 0,
      onOps: (batch) => services.blocks.apply(batch),
    });
  };
  const p = (id: string, value: string): Seed => ({ id, type: "paragraph", content: [{ text: value }] });
  const md = (markdown: string) => fromMarkdown(markdown, { findTarget: () => null, newId: () => `m${++ids}` });
  /** The stored page as `type:text` lines, children indented. */
  const outline = (state?: EditorState) => {
    const s = state ?? stateFromTree(services.blocks.loadTree("page")!);
    const lines: string[] = [];
    const visit = (id: string, depth: number) => {
      for (const child of s.blocks[id]!.children) {
        lines.push(`${"  ".repeat(depth)}${s.blocks[child]!.type}:${plain(s.blocks[child]!.content)}`);
        visit(child, depth + 1);
      }
    };
    visit(s.rootId, 0);
    return lines;
  };

  beforeEach(() => {
    services = createInMemoryServices();
    ids = 0;
  });

  describe("pasting", () => {
    it("replaces an empty paragraph with a pasted list, undone in one step", () => {
      seed([p("a", "")]);
      editor.setSelection(caret("a", 0));
      expect(editor.paste(md("- one\n- **two**\n- three"))).toBe(true);
      expect(outline()).toEqual(["bulleted_list_item:one", "bulleted_list_item:two", "bulleted_list_item:three"]);
      expect(services.blocks.loadTree("page")!.children![1]!.block.content).toEqual([{ text: "two", marks: ["bold"] }]);
      editor.undo();
      expect(outline()).toEqual(["paragraph:"]);
    });

    it("joins the first paragraph to the text before the caret and puts the caret at the end", () => {
      seed([p("a", "Notes: ")]);
      editor.setSelection(caret("a", 7));
      editor.paste(md("Intro\n\n| a | b |\n|---|---|\n| 1 | 2 |\n\n```ts\nlet x = 1;\n```"));
      expect(outline()).toEqual([
        "paragraph:Notes: Intro",
        "table:",
        "  table_row:",
        "    table_cell:a",
        "    table_cell:b",
        "  table_row:",
        "    table_cell:1",
        "    table_cell:2",
        "code:let x = 1;",
      ]);
      const code = Object.values(editor.state.blocks).find((b) => b.type === "code")!;
      expect(editor.selection).toEqual(caret(code.id, 10));
    });

    it("splits a sentence around pasted paragraphs", () => {
      seed([p("a", "Hello world")]);
      editor.setSelection(caret("a", 6));
      editor.paste(md("A\n\nB"));
      expect(outline()).toEqual(["paragraph:Hello A", "paragraph:B", "paragraph:world"]);
    });

    it("types one pasted paragraph in at the caret with its marks", () => {
      seed([p("a", "a  b")]);
      editor.setSelection(caret("a", 2));
      editor.paste(md("**bold**"));
      expect(outline()).toEqual(["paragraph:a bold b"]);
      expect(editor.state.blocks.a!.content).toEqual([{ text: "a " }, { text: "bold", marks: ["bold"] }, { text: " b" }]);
      expect(editor.selection).toEqual(caret("a", 6));
    });

    it("replaces the selected text", () => {
      seed([p("a", "keep this out")]);
      editor.setSelection({ blockId: "a", anchor: 5, focus: 9 });
      editor.paste(md("that"));
      expect(outline()).toEqual(["paragraph:keep that out"]);
    });

    it("leaves code, cells and the title to plain text", () => {
      seed([{ id: "c", type: "code", props: { language: "" }, content: [{ text: "x" }] }]);
      editor.setSelection(caret("c", 1));
      expect(editor.paste(md("- one\n- two"))).toBe(false);
      editor.setSelection(caret("page", 0));
      expect(editor.paste(md("- one"))).toBe(false);
      expect(outline()).toEqual(["code:x"]);
    });
  });

  describe("copying", () => {
    const copied = (from: [string, number], to: [string, number]) =>
      toMarkdown(selectedTrees(editor.state, { blockId: from[0], offset: from[1] }, { blockId: to[0], offset: to[1] }), reader);

    it("writes the selected blocks as Markdown, cutting the first and last", () => {
      seed([
        { id: "h", type: "heading", props: { level: 2 }, content: [{ text: "Heading" }] },
        { id: "l1", type: "bulleted_list_item", content: [{ text: "one" }] },
        { id: "l2", type: "bulleted_list_item", content: [{ text: "two" }] },
        p("x", "after the list"),
      ]);
      expect(copied(["h", 0], ["l2", 3])).toBe("## Heading\n\n- one\n- two");
      expect(copied(["x", 9], ["l1", 1])).toBe("- ne\n- two\n\nafter the");
    });

    it("takes a table whole, and children with their parent", () => {
      seed([
        p("a", "Before"),
        {
          id: "t",
          type: "table",
          children: [
            { id: "r1", type: "table_row", children: [{ id: "c1", type: "table_cell", content: [{ text: "a" }] }, { id: "c2", type: "table_cell", content: [{ text: "b" }] }] },
            { id: "r2", type: "table_row", children: [{ id: "c3", type: "table_cell", content: [{ text: "1" }] }, { id: "c4", type: "table_cell", content: [{ text: "2" }] }] },
          ],
        },
        { id: "g", type: "toggle", content: [{ text: "More" }], children: [p("g1", "inside")] },
      ]);
      expect(copied(["a", 3], ["c2", 0])).toBe("ore\n\n| a | b |\n|---|---|\n| 1 | 2 |");
      expect(copied(["g", 0], ["g", 4])).toBe("▸ More\n  inside");
    });

    it("pastes back what it copied", () => {
      seed([p("a", "Intro"), { id: "l1", type: "todo", props: { checked: true }, content: [{ text: "done" }] }, p("b", "")]);
      const markdown = copied(["a", 0], ["l1", 4]);
      editor.setSelection(caret("b", 0));
      editor.paste(md(markdown));
      expect(outline()).toEqual(["paragraph:Intro", "todo:done", "paragraph:Intro", "todo:done"]);
    });
  });
});
