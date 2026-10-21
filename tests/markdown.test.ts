import { describe, expect, it } from "vitest";

import {
  fromMarkdown,
  MARKDOWN_GUIDE,
  type MarkdownBlock,
  type MarkdownReader,
  type MarkdownWriter,
  toMarkdown,
} from "~/domain/blocks/markdown";
import { type Block, BLOCK_TYPES, type BlockType, type RichText, type TreeNode } from "~/domain/blocks/types";

const node = (
  id: string,
  type: BlockType,
  content: RichText = [],
  props: Record<string, unknown> = {},
  children: TreeNode[] = [],
): TreeNode => ({
  block: { id, type, props, content, parentId: null, owner: null, createdAt: "", updatedAt: "" } as Block,
  children,
});
const t = (text: string, marks?: RichText[number]["marks"]) => (marks ? { text, marks } : { text });
const m = (pageId: string) => ({ text: "￼", mention: { pageId } });

const reader: MarkdownReader = {
  mentionTarget: (pageId) =>
    pageId === "task-body"
      ? { kind: "task", id: "1a2b3c4d", title: "Add login" }
      : pageId === "arch"
        ? { kind: "page", id: "arch", title: "Architecture" }
        : null,
  referenceTarget: (id) =>
    id === "arch"
      ? { kind: "page", id: "arch", title: "Architecture" }
      : id === "b1"
        ? { kind: "block", text: "Quoted line" }
        : null,
  appLink: (href) =>
    href.startsWith("/pages/") ? `page:${href.slice(7)}` : href.startsWith("/tasks/") ? `task:${href.slice(7)}` : undefined,
  pageId: (id) => id,
  contentUrl: (id) => `https://host/task-manager/content/${id}`,
};

let ids = 0;
const writer: MarkdownWriter = {
  findTarget: (kind, id) =>
    kind === "task" && id === "1a2b3c4d"
      ? { pageId: "task-body", href: "/tasks/1a2b3c4dfull" }
      : kind === "page" && id === "arch"
        ? { pageId: "arch", href: "/pages/arch" }
        : null,
  newId: () => `n${++ids}`,
};

describe("blocks to Markdown", () => {
  it("writes every block type, keeping lists together and nesting by indentation", () => {
    const md = toMarkdown(
      [
        node("h", "heading", [t("Title")], { level: 2 }),
        node("p", "paragraph", [
          t("Plain "),
          t("bold", ["bold"]),
          t(" and "),
          t("code", ["code"]),
          t(" "),
          t("site", [{ type: "link", href: "https://x.dev" }]),
        ]),
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
        node("mm", "paragraph", [
          t("See "),
          m("task-body"),
          t(" and "),
          m("gone"),
          t(" "),
          t("doc", [{ type: "link", href: "/pages/arch" }]),
        ]),
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
    const blocks = fromMarkdown(
      "# Plan\n\nLine one\nline two\n\n- a\n  - a1\n1. n\n- [ ] open\n- [x] closed\n> q\n\n---\n\n*it* ~~st~~ <u>un</u>",
      writer,
    );
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
    const [p] = fromMarkdown(
      "@[Add login](task:1a2b3c4d) @[Nope](task:ffffffff) [doc](page:arch) [x](page:nope) [web](https://x.dev)",
      writer,
    );
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

describe("anchors and suggestions", () => {
  const anchored: MarkdownReader = { ...reader, anchor: (id) => id.padEnd(8, "0") };

  it("ends each block's first line with its anchor, nested ones too", () => {
    const tree = [
      node("h", "heading", [t("Goals")], { level: 2 }),
      node("q", "quote", [t("one\ntwo")]),
      node("b", "bulleted_list_item", [t("Ship it")], {}, [node("c", "bulleted_list_item", [t("Soon")])]),
    ];
    expect(toMarkdown(tree, anchored)).toBe("## Goals ^h0000000\n\n> one ^q0000000\n> two\n\n- Ship it ^b0000000\n  - Soon ^c0000000");
    expect(toMarkdown(tree, reader)).not.toContain("^");
  });

  it("drops anchors when Markdown read with them is written back", () => {
    const blocks = fromMarkdown("## Goals ^h0000000\n\n- Ship it ^b0000000\n  - Soon ^c0000000", writer);
    expect(blocks.map((b) => b.content)).toEqual([[t("Goals")], [t("Ship it")]]);
    expect(blocks[1]!.children![0]!.content).toEqual([t("Soon")]);
  });

  it("writes a suggestion as tag lines around its blocks, at its depth", () => {
    const withSuggestions: MarkdownReader = {
      ...reader,
      suggestion: (id) =>
        id === "s" ? { id: "s", by: "builder", action: "replace", target: "p", status: "outdated", note: 'Say "hi"' } : null,
    };
    const tree = [
      node("p", "paragraph", [t("Hello")]),
      node("s", "suggestion", [], { action: "replace", targetId: "p" }, [node("n", "paragraph", [t("Hi")])]),
      node("tog", "toggle", [t("More")], {}, [node("s2", "suggestion", [], { action: "insert" }, [node("n2", "todo", [t("Do")], { checked: false })])]),
    ];
    expect(toMarkdown(tree, withSuggestions)).toBe(
      [
        "Hello",
        "",
        '<suggestion id="s" by="builder" action="replace" target="p" status="outdated" note="Say &quot;hi&quot;">',
        "Hi",
        "</suggestion>",
        "",
        "▸ More",
        "  <suggestion>",
        "  - [ ] Do",
        "  </suggestion>",
      ].join("\n"),
    );
  });
});

describe("marks spanning several spans", () => {
  const roundTrip = (markdown: string) =>
    toMarkdown(
      fromMarkdown(markdown, writer).map((block) => ({ block: block as unknown as Block, children: [] })),
      reader,
    );

  it.each([
    "**Correction: `.pm-cli` is not skippable.**",
    "~~`.pm-cli` — skip~~",
    "**bold *and italic* inside**",
    "[see **this** part](https://example.com) after",
    "~~a **b** c~~ and `code`",
    "plain **bold** plain *italic* plain",
  ])("writes %s back unchanged", (markdown) => {
    expect(roundTrip(markdown)).toBe(markdown);
  });

  it("opens a mark once across spans that share it", () => {
    const tree = [node("p", "paragraph", [t("a ", ["bold"]), t("b", ["bold", "code"]), t(" c", ["bold"])])];
    expect(toMarkdown(tree, reader)).toBe("**a `b` c**");
  });
});

describe("tables, code, headings 4–6 and callouts", () => {
  /** Written blocks as a tree, as if stored and loaded. */
  const tree = (blocks: MarkdownBlock[]): TreeNode[] =>
    blocks.map(({ children, ...block }) => ({
      block: { props: {}, content: [], ...block } as unknown as Block,
      children: tree(children ?? []),
    }));
  const read = (markdown: string, warnings?: string[]) => fromMarkdown(markdown, writer, warnings);
  const roundTrip = (markdown: string) => toMarkdown(tree(read(markdown)), reader);
  const cells = (table: MarkdownBlock) => table.children!.map((row) => row.children!.map((cell) => cell.content));

  it.each([
    "| Subtopic | Rating |\n|---|---|\n| DNS | 🟡 **Shaky** |",
    "```sh\nstrace -f ./server\n```\n\n> [!WARNING] ⚠️ Don't load a movement that scored 0",
    "#### Four\n\n##### Five\n\n###### Six",
    "> [!TIP] ✅ First line\n> second line\n  - nested in the callout",
    "|  |  |\n|---|---|\n| a | b |",
    "| a \\| b | x<br>y |\n|---|---|\n| `c \\| d` | e |",
    "````md\n```js\nlet x;\n```\n````",
  ])("round-trips %j", (markdown) => {
    expect(roundTrip(markdown)).toBe(markdown);
  });

  it("reads a table: header row, rows padded or cut to its width, alignment ignored", () => {
    const [table] = read("| Time | Soil | Notes |\n|:---|:---:|---:|\n| 10:00 | | |\n| 13:00 | 27.5 | ok | extra |\n| 15:00 |");
    expect(table).toMatchObject({ type: "table", props: { headerRow: true, headerColumn: false } });
    expect(cells(table!)).toEqual([
      [[{ text: "Time" }], [{ text: "Soil" }], [{ text: "Notes" }]],
      [[{ text: "10:00" }], [], []],
      [[{ text: "13:00" }], [{ text: "27.5" }], [{ text: "ok" }]],
      [[{ text: "15:00" }], [], []],
    ]);
  });

  it("reads an all-empty header row as a table without one, and escapes in cells", () => {
    const [table] = read("|  |  |\n|---|---|\n| a \\| b | x<br>y |");
    expect(table).toMatchObject({ props: { headerRow: false } });
    expect(cells(table!)).toEqual([[[{ text: "a | b" }], [{ text: "x\ny" }]]]);
  });

  it("keeps code verbatim, less its fence's indentation, and never parses inside it", () => {
    const [list] = read("- step\n  ```ts\n  const a = **b**; // [!NOTE]\n    indented\n  ```");
    expect(list!.children).toEqual([
      { id: expect.any(String), type: "code", props: { language: "ts" }, content: [{ text: "const a = **b**; // [!NOTE]\n  indented" }] },
    ]);
  });

  it("gives a callout without an emoji its tone's, and reads the marker alone on its line", () => {
    const [plain, alone] = read("> [!CAUTION] Careful\n\n> [!note]\n> On the next line");
    expect(plain).toMatchObject({ type: "callout", props: { emoji: "🛑", tone: "error" }, content: [{ text: "Careful" }] });
    expect(alone).toMatchObject({ type: "callout", props: { emoji: "💡", tone: "default" }, content: [{ text: "On the next line" }] });
  });

  it("drops the anchor on a table's first line and a fence's", () => {
    const [table, code] = read("| a | ^1a2b3c4d\n|---|\n\n```sh ^5e6f7a8b\nls\n```");
    expect(table).toMatchObject({ type: "table" });
    expect(code).toMatchObject({ type: "code", props: { language: "sh" }, content: [{ text: "ls" }] });
  });

  it("guides agents through every block the importer creates, with examples that read as that block", () => {
    // Types the importer never creates: pages, references, comments and suggestions aren't written as
    // Markdown, toggles read back as paragraphs, and rows and cells are part of a table.
    const notImported = ["page", "reference", "comment", "suggestion", "toggle", "table_row", "table_cell"];
    expect(MARKDOWN_GUIDE.blocks.map((b) => b.type).sort()).toEqual(BLOCK_TYPES.filter((type) => !notImported.includes(type)).sort());
    for (const { type, example } of MARKDOWN_GUIDE.blocks) expect(read(example).map((b) => b.type)).toEqual([type]);
  });

  it("reports what it keeps as text, by line, and nothing for what it supports", () => {
    const warnings: string[] = [];
    read(
      [
        "Intro",
        "",
        "![chart](chart.png)",
        "A note[^1] and <div>html</div>, `<b>` in code is fine, <u>underline</u> too",
        "| a | b |",
        "| c | d |",
        "```js",
        "never closed",
      ].join("\n"),
      warnings,
    );
    expect(warnings).toEqual([
      "Line 3: images need an http(s) URL or an uploaded image; kept as text",
      "Line 4: footnotes aren't supported; kept as text",
      "Line 4: HTML (<div>) isn't supported; kept as text",
      "Line 5: a table needs a separator row (|---|) under its header; kept as text",
      "Line 7: this code fence is never closed; kept as text",
    ]);
    const none: string[] = [];
    read("| a | b<br>c |\n|---|---|\n\n```\n<div>![x](y)\n```\n\n> [!TIP] ok", none);
    expect(none).toEqual([]);
  });
});

describe("images", () => {
  const ID = `${"ab".repeat(32)}.png`;
  const read = (markdown: string, warnings?: string[]) => fromMarkdown(markdown, writer, warnings);

  it("reads a line that is only an image: uploaded items by their URL, other http(s) URLs as external; nothing nests in one", () => {
    const warnings: string[] = [];
    const blocks = read(
      [
        "![Latency p95](https://grafana.example/render/p95.png)",
        `![Error dialog](https://host/task-manager/content/${ID})`,
        `![Relative](/task-manager/content/${ID})`,
        `  ![Nested, with a title](https://x.dev/a.png "A title")`,
        "![](http://x.dev/b.gif)",
      ].join("\n"),
      warnings,
    );
    expect(warnings).toEqual([]);
    expect(blocks).toMatchObject([
      { type: "image", props: { url: "https://grafana.example/render/p95.png", alt: "Latency p95" } },
      { type: "image", props: { contentId: ID, alt: "Error dialog" } },
      { type: "image", props: { contentId: ID, alt: "Relative" } },
      { type: "image", props: { url: "https://x.dev/a.png", alt: "Nested, with a title" } },
      { type: "image", props: { url: "http://x.dev/b.gif", alt: "" } },
    ]);
  });

  it("keeps images without an http(s) URL, and images inside text, as text with warnings", () => {
    const warnings: string[] = [];
    const blocks = read(["![chart](chart.png)", "", "![x](data:image/png;base64,AAAA)", "", "See ![icon](https://x.dev/i.png) here"].join("\n"), warnings);
    expect(blocks.map((b) => b.type)).toEqual(["paragraph", "paragraph", "paragraph"]);
    expect(warnings).toEqual([
      "Line 1: images need an http(s) URL or an uploaded image; kept as text",
      "Line 3: images need an http(s) URL or an uploaded image; kept as text",
      "Line 5: images must be on a line of their own; kept as text",
    ]);
  });

  it("writes images on their own lines, uploaded ones by the reader's URL, and reads them back", () => {
    const nodes = [
      node("i1", "image", [], { contentId: ID, alt: "Error [dialog]\nsecond line" }),
      node("i2", "image", [], { url: "https://x.dev/a (1).png", alt: "" }),
    ];
    const markdown = toMarkdown(nodes, reader);
    expect(markdown).toBe(`![Error \\[dialog\\] second line](https://host/task-manager/content/${ID})\n\n![](https://x.dev/a%20%281%29.png)`);
    expect(read(markdown)).toMatchObject([
      { type: "image", props: { contentId: ID, alt: "Error [dialog] second line" } },
      { type: "image", props: { url: "https://x.dev/a%20%281%29.png", alt: "" } },
    ]);
  });
});
