import { createServices } from "~/composition";
import type { NewBlock, Operation, RichText } from "~/domain/blocks/types";

/** Fixed IDs make seeding idempotent: if the welcome page exists, there is nothing to do. */
const id = (name: string) => `seed-${name}`;
const text = (value: string): RichText => [{ text: value }];

/** Inserts blocks as consecutive children of a parent, each after the previous one. */
function children(parentId: string, blocks: (NewBlock & { children?: NewBlock[] })[]): Operation[] {
  const ops: Operation[] = [];
  let afterId: string | null = null;
  for (const { children: nested, ...block } of blocks) {
    ops.push({ op: "insert", block, parentId, afterId });
    if (nested) ops.push(...children(block.id, nested));
    afterId = block.id;
  }
  return ops;
}

const welcome: Operation[] = [
  { op: "insert", block: { id: id("welcome"), type: "page", content: text("Welcome") }, parentId: null },
  ...children(id("welcome"), [
    { id: id("welcome-intro"), type: "paragraph", content: text("This workspace is seeded with sample pages.") },
    {
      id: id("welcome-tip"),
      type: "paragraph",
      content: [
        { text: "Open " },
        { text: "Block showcase", marks: ["bold"] },
        { text: " to see every block type rendered." },
      ],
    },
  ]),
];

const showcase: Operation[] = [
  {
    op: "insert",
    block: { id: id("showcase"), type: "page", content: text("Block showcase") },
    parentId: null,
    afterId: id("welcome"),
  },
  ...children(id("showcase"), [
    { id: id("h1"), type: "heading", props: { level: 1 }, content: text("Headings") },
    { id: id("h2"), type: "heading", props: { level: 2 }, content: text("Second level") },
    { id: id("h3"), type: "heading", props: { level: 3 }, content: text("Third level") },
    { id: id("marks-heading"), type: "heading", props: { level: 1 }, content: text("Text and marks") },
    {
      id: id("marks"),
      type: "paragraph",
      content: [
        { text: "Plain, " },
        { text: "bold", marks: ["bold"] },
        { text: ", " },
        { text: "italic", marks: ["italic"] },
        { text: ", " },
        { text: "underline", marks: ["underline"] },
        { text: ", " },
        { text: "strikethrough", marks: ["strikethrough"] },
        { text: ", " },
        { text: "inline code", marks: ["code"] },
        { text: " and a " },
        { text: "link", marks: [{ type: "link", href: "https://github.com/wildchild04" }] },
        { text: "." },
      ],
    },
    { id: id("quote"), type: "quote", content: text("A quote block, for things worth repeating.") },
    { id: id("lists-heading"), type: "heading", props: { level: 1 }, content: text("Lists and todos") },
    { id: id("todo-done"), type: "todo", props: { checked: true }, content: text("A finished todo") },
    { id: id("todo-open"), type: "todo", props: { checked: false }, content: text("An open todo") },
    {
      id: id("bullet-1"),
      type: "bulleted_list_item",
      content: text("A bullet"),
      children: [{ id: id("bullet-1-1"), type: "bulleted_list_item", content: text("A nested bullet") }],
    },
    { id: id("bullet-2"), type: "bulleted_list_item", content: text("Another bullet") },
    { id: id("num-1"), type: "numbered_list_item", content: text("First") },
    { id: id("num-2"), type: "numbered_list_item", content: text("Second") },
    { id: id("num-break"), type: "paragraph", content: text("A paragraph restarts the numbering:") },
    { id: id("num-3"), type: "numbered_list_item", content: text("First again") },
    {
      id: id("toggle"),
      type: "toggle",
      content: text("A toggle with children"),
      children: [
        { id: id("toggle-1"), type: "paragraph", content: text("Toggle content is nested under it.") },
        { id: id("toggle-2"), type: "todo", content: text("Even todos") },
      ],
    },
    { id: id("divider"), type: "divider" },
    { id: id("pages-heading"), type: "heading", props: { level: 1 }, content: text("Pages and references") },
    {
      id: id("subpage"),
      type: "page",
      content: text("A sub-page"),
      children: [{ id: id("subpage-body"), type: "paragraph", content: text("Sub-pages are separate pages.") }],
    },
    { id: id("ref-page"), type: "reference", props: { targetId: id("welcome") } },
    { id: id("ref-block"), type: "reference", props: { targetId: id("welcome-tip") } },
    { id: id("doomed"), type: "paragraph", content: text("This block is deleted below.") },
    { id: id("ref-missing"), type: "reference", props: { targetId: id("doomed") } },
    { id: id("ref-cycle"), type: "reference", props: { targetId: id("showcase") } },
  ]),
  { op: "delete", id: id("doomed") },
];

const services = createServices();
try {
  if (await services.blocks.getBlock(id("welcome"))) {
    console.log("Sample pages already exist; nothing to seed.");
  } else {
    await services.blocks.apply([...welcome, ...showcase]);
    console.log("Seeded the Welcome and Block showcase pages.");
  }
} finally {
  services.close();
}
