import { describe, expect, it } from "vitest";

import { fromMarkdown, type MarkdownReader, type MarkdownWriter, toMarkdown } from "~/domain/blocks/markdown";
import type { Block, BlockType, RichText, TreeNode } from "~/domain/blocks/types";

const node = (id: string, type: BlockType, content: RichText = [], props: Record<string, unknown> = {}, children: TreeNode[] = []): TreeNode => ({
  block: { id, type, props, content, parentId: null, owner: null, createdAt: "", updatedAt: "" } as Block,
  children,
});
const t = (text: string, marks?: RichText[number]["marks"]) => (marks ? { text, marks } : { text });
const m = (pageId: string) => ({ text: "￼", mention: { pageId } });

const reader: MarkdownReader = {
  mentionTarget: (pageId) =>
    pageId === "task-body" ? { kind: "task", id: "1a2b3c4d", title: "Add login" } : pageId === "arch" ? { kind: "page", id: "arch", title: "Architecture" } : null,
  referenceTarget: (id) => (id === "arch" ? { kind: "page", id: "arch", title: "Architecture" } : id === "b1" ? { kind: "block", text: "Quoted line" } : null),
  appLink: (href) => (href.startsWith("/pages/") ? `page:${href.slice(7)}` : href.startsWith("/tasks/") ? `task:${href.slice(7)}` : undefined),
  pageId: (id) => id,
};

let ids = 0;
const writer: MarkdownWriter = {
  findTarget: (kind, id) =>
    kind === "task" && id === "1a2b3c4d" ? { pageId: "task-body", href: "/tasks/1a2b3c4dfull" } : kind === "page" && id === "arch" ? { pageId: "arch", href: "/pages/arch" } : null,
  newId: () => `n${++ids}`,
};

describe("blocks to Markdown", () => {
  it("writes every block type, keeping lists together and nesting by indentation", () => {
    const md = toMarkdown(
      [
        node("h", "heading", [t("Title")], { level: 2 }),
        node("p", "paragraph", [t("Plain "), t("bold", ["bold"]), t(" and "), t("code", ["code"]), t(" "), t("site", [{ type: "link", href: "https://x.dev" }])]),
        node("b1", "bulleted_list_item", [t("one")], {}, [node("b2", "bulleted_list_item", [t("nested")])]),
        node("n1", "numbered_list_item", [t("first")]),
        node("n2", "numbered_list_item", [t("second")]),
        node("td", "todo", [t("done")], { checked: true }),
        node("q", "quote", [t("Said")]),
        node("d", "divider"),
        node("tg", "toggle", [t("More")], {}, [node("c", "paragraph", [t("Inside")])]),
        node("sp", "page", [t("Sub")]),
        node("r1", "reference", [], { targetId: "arch" }),
        node("r2", "reference", [], { targetId: "b1" }),
        node("r3", "reference", [], { targetId: "gone" }),
        node("mm", "paragraph", [t("See "), m("task-body"), t(" and "), m("gone"), t(" "), t("doc", [{ type: "link", href: "/pages/arch" }])]),
      ],
      reader,
    );
    expect(md).toBe(
      [
        "## Title",
        "",
        "Plain **bold** and `code` [site](https://x.dev)",
        "",
        "- one\n  - nested\n1. first\n2. second\n- [x] done",
        "",
        "> Said",
        "",
        "---",
        "",
        "▸ More\n  Inside",
        "",
        "[Sub](page:sp)",
        "",
        "[Architecture](page:arch)",
        "",
        "> Quoted line",
        "",
        "(missing reference)",
        "",
        "See @[Add login](task:1a2b3c4d) and @[missing page] [doc](page:arch)",
      ].join("\n"),
    );
  });
});

describe("Markdown to blocks", () => {
  it("reads block types, joined paragraph lines, nesting and marks", () => {
    ids = 0;
    const blocks = fromMarkdown("# Plan\n\nLine one\nline two\n\n- a\n  - a1\n1. n\n- [ ] open\n- [x] closed\n> q\n\n---\n\n*it* ~~st~~ <u>un</u>", writer);
    expect(blocks.map((b) => [b.type, b.props, b.content, b.children?.map((c) => [c.type, c.content])])).toEqual([
      ["heading", { level: 1 }, [{ text: "Plan" }], undefined],
      ["paragraph", {}, [{ text: "Line one\nline two" }], undefined],
      ["bulleted_list_item", {}, [{ text: "a" }], [["bulleted_list_item", [{ text: "a1" }]]]],
      ["numbered_list_item", {}, [{ text: "n" }], undefined],
      ["todo", { checked: false }, [{ text: "open" }], undefined],
      ["todo", { checked: true }, [{ text: "closed" }], undefined],
      ["quote", {}, [{ text: "q" }], undefined],
      ["divider", {}, [], undefined],
      ["paragraph", {}, [t("it", ["italic"]), t(" "), t("st", ["strikethrough"]), t(" "), t("un", ["underline"])], undefined],
    ]);
  });

  it("resolves mentions and app links, keeping unknown ones as plain text", () => {
    const [p] = fromMarkdown("@[Add login](task:1a2b3c4d) @[Nope](task:ffffffff) [doc](page:arch) [x](page:nope) [web](https://x.dev)", writer);
    expect(p!.content).toEqual([
      m("task-body"),
      t(" @[Nope](task:ffffffff) "),
      t("doc", [{ type: "link", href: "/pages/arch" }]),
      t(" [x](page:nope) "),
      t("web", [{ type: "link", href: "https://x.dev" }]),
    ]);
  });

  it("round-trips the spec's comment", () => {
    const markdown = "Fixed in **two** places:\n\n- [x] parser\n- [ ] see @[Add login](task:1a2b3c4d)";
    const blocks = fromMarkdown(markdown, writer);
    expect(blocks.map((b) => b.type)).toEqual(["paragraph", "todo", "todo"]);
    expect(blocks[2]!.content).toEqual([t("see "), m("task-body")]);
    const tree = (list: typeof blocks): TreeNode[] =>
      list.map((b) => node(b.id, b.type, b.content ?? [], b.props ?? {}, tree(b.children ?? [])));
    expect(toMarkdown(tree(blocks), reader)).toBe(markdown);
  });
});
