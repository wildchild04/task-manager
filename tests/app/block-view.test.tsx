import { DesignSystemProvider } from "@wildchild/design-system";
import { renderToString } from "react-dom/server";
import { MemoryRouter } from "react-router";
import { describe, expect, it } from "vitest";

import { Blocks } from "../../app/blocks/block-view";
import type { ContentBlockType, ViewBlock } from "../../app/blocks/view-model";

const content = (id: string, type: ContentBlockType, value: string, props: Record<string, unknown> = {}): ViewBlock => ({
  kind: "content",
  id,
  type,
  props,
  content: value ? [{ text: value }] : [],
  children: [],
});

function render(blocks: ViewBlock[]) {
  return renderToString(
    <MemoryRouter>
      <DesignSystemProvider mode="light">
        <Blocks blocks={blocks} />
      </DesignSystemProvider>
    </MemoryRouter>,
  );
}

describe("block renderers", () => {
  it("renders every block type", () => {
    const html = render([
      content("p", "paragraph", "para-text"),
      content("h", "heading", "heading-text", { level: 2 }),
      content("t", "todo", "todo-text", { checked: true }),
      content("b", "bulleted_list_item", "bullet-text"),
      content("n", "numbered_list_item", "numbered-text"),
      { ...content("g", "toggle", "toggle-text"), children: [content("g1", "paragraph", "toggle-child")] } as ViewBlock,
      content("q", "quote", "quote-text"),
      content("d", "divider", ""),
      { kind: "subpage", id: "s", title: [{ text: "subpage-title" }] },
      { kind: "reference", id: "r1", target: { status: "page", pageId: "x", title: [{ text: "ref-page" }] } },
      { kind: "reference", id: "r2", target: { status: "block", block: content("rb", "paragraph", "ref-block") } },
      { kind: "reference", id: "r3", target: { status: "missing" } },
      { kind: "reference", id: "r4", target: { status: "cycle" } },
    ]);

    for (const fragment of [
      "para-text",
      "<h3",
      "heading-text",
      "todo-text",
      'type="checkbox"',
      "checked",
      "<ul",
      "bullet-text",
      "<ol",
      "numbered-text",
      "toggle-text",
      'aria-label="Open toggle"',
      "<blockquote",
      "quote-text",
      "<hr",
      'href="/pages/s"',
      "subpage-title",
      'href="/pages/x"',
      "ref-block",
      "Missing reference",
      "Circular reference",
    ]) {
      expect(html).toContain(fragment);
    }
    // Toggles start folded: their children aren't shown until opened.
    expect(html).not.toContain("toggle-child");
  });

  it("restarts numbering after another block", () => {
    const html = render([
      content("n1", "numbered_list_item", "one"),
      content("n2", "numbered_list_item", "two"),
      content("p", "paragraph", "break"),
      content("n3", "numbered_list_item", "one-again"),
    ]);
    expect(html.match(/<ol/g)).toHaveLength(2);
    expect(html.indexOf("two")).toBeLessThan(html.indexOf("</ol>"));
  });

  it("renders marks", () => {
    const html = render([
      {
        kind: "content",
        id: "m",
        type: "paragraph",
        props: {},
        children: [],
        content: [
          { text: "strong-text", marks: ["bold"] },
          { text: "link-text", marks: [{ type: "link", href: "https://example.com" }, "italic"] },
        ],
      },
    ]);
    expect(html).toMatch(/<strong>strong-text<\/strong>/);
    expect(html).toMatch(/href="https:\/\/example.com"[^>]*>.*<em>link-text<\/em>/s);
  });
});

describe("suggestion boxes", () => {
  const suggestion = (fields: Partial<Extract<ViewBlock, { kind: "suggestion" }>>): ViewBlock => ({
    kind: "suggestion",
    id: "s",
    author: "builder",
    action: "insert",
    note: null,
    outdated: false,
    targetId: null,
    blocks: [content("n", "paragraph", "proposed-text")],
    removed: null,
    ...fields,
  });

  it("shows the author, the action, the note, the proposed blocks and the decision", () => {
    const html = render([suggestion({ note: "From the audit" })]);
    for (const text of ["builder", "Suggests adding", "From the audit", "proposed-text", "Reject", "Approve"]) expect(html).toContain(text);
    expect(html).toMatch(/data-review-proposed="true" aria-label="Proposed"[\s\S]*proposed-text/);
    // Before the editor takes over, there's nothing to decide with.
    expect(html).toMatch(/disabled=""><span[^>]*><\/span>Approve/);
  });

  it("shows a replace's old block struck through, and an outdated one without Approve", () => {
    const html = render([
      suggestion({ action: "replace", targetId: "p", removed: content("p", "paragraph", "old-text"), outdated: true }),
    ]);
    expect(html).toContain("Suggests replacing");
    expect(html).toMatch(/data-review-removed="true" aria-label="Removed"[\s\S]*old-text/);
    expect(html).toContain("Outdated");
    expect(html).toMatch(/<\/span>Reject</);
    expect(html).not.toMatch(/<\/span>Approve</);
  });
});

describe("tables, code, callouts and headings 4–6", () => {
  const cell = (id: string, value: string) => content(id, "table_cell", value);
  const row = (id: string, ...cells: ViewBlock[]) => ({ ...content(id, "table_row", ""), children: cells }) as ViewBlock;
  const table = (props: Record<string, unknown>, ...rows: ViewBlock[]) =>
    ({ ...content("t", "table", "", props), children: rows }) as ViewBlock;
  /** The markup without the design system's inline styles and classes, to compare structure. */
  const bare = (html: string) => html.replace(/<style[^>]*>[^<]*<\/style>/g, "").replace(/ class="[^"]*"/g, "");

  it("renders a header row as column headers and the rest as rows, scrolling inside the page", () => {
    const html = render([
      table(
        { headerRow: true, headerColumn: false },
        row("r1", cell("a", "Surface"), cell("b", "Sun")),
        row("r2", cell("c", "Tile"), cell("d", "61°C")),
      ),
    ]);
    expect(bare(html)).toContain(
      '<tr><th scope="col"><span>Surface</span></th><th scope="col"><span>Sun</span></th></tr>' +
        "<tr><td><span>Tile</span></td><td><span>61°C</span></td></tr>",
    );
    // Wide tables scroll inside their container.
    expect(html).toMatch(/MuiTableContainer-root[^{]*\{[^}]*overflow-x:auto/);
  });

  it("renders a header column as row headers, and no column headers without a header row", () => {
    const html = render([table({ headerRow: false, headerColumn: true }, row("r1", cell("a", "DNS"), cell("b", "Shaky")))]);
    expect(bare(html)).not.toContain('scope="col"');
    expect(bare(html)).toContain('<tr><th scope="row"><span>DNS</span></th><td><span>Shaky</span></td></tr>');
  });

  it("renders code with its language and a copy button", () => {
    const html = render([content("k", "code", "strace -f ./server", { language: "sh" })]);
    expect(html).toContain("strace -f ./server");
    expect(html).toContain('aria-label="Code, sh"');
    expect(html).toContain("Copy code");
  });

  it("renders a callout of its tone with its emoji, text and nested blocks, not as an announcement", () => {
    const callout = content("c", "callout", "Don't load a movement that scored 0", { emoji: "⚠️", tone: "warning" });
    const html = render([{ ...callout, children: [content("c1", "paragraph", "nested-text")] } as ViewBlock]);
    expect(html).toContain('data-callout-tone="warning"');
    expect(html).toMatch(/data-callout-icon="true">⚠️<\/div>/);
    expect(html).toContain("Don&#x27;t load a movement that scored 0");
    expect(html).toContain("nested-text");
    expect(html).not.toMatch(/role="(alert|status)"/);
  });

  it("renders headings 4 and 5 as h5 and h6, and 6 with its real level", () => {
    const html = render([
      content("h4", "heading", "four", { level: 4 }),
      content("h5", "heading", "five", { level: 5 }),
      content("h6", "heading", "six", { level: 6 }),
    ]);
    expect(html).toMatch(/<h5[^>]*><span>four<\/span><\/h5>/);
    expect(html).toMatch(/<h6[^>]*><span>five<\/span><\/h6>/);
    expect(html).toMatch(/<div role="heading" aria-level="7" class="block-heading-6"[^>]*><span>six<\/span><\/div>/);
  });
});

describe("line breaks", () => {
  it("shows a paragraph's line breaks", () => {
    const html = render([content("p", "paragraph", "| a | b |\n|---|---|\n| 1 | 2 |")]);
    expect(html).toMatch(/\| a \| b \|<br\/>\|---\|---\|<br\/>\| 1 \| 2 \|/);
  });
});
