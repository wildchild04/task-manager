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
    expect(html).toContain('role="group"');
    // Before the editor takes over, there's nothing to decide with.
    expect(html).toMatch(/disabled=""><span[^>]*><\/span>Approve/);
  });

  it("shows a replace's old block struck through, and an outdated one without Approve", () => {
    const html = render([
      suggestion({ action: "replace", targetId: "p", removed: content("p", "paragraph", "old-text"), outdated: true }),
    ]);
    expect(html).toContain("Suggests replacing");
    expect(html).toMatch(/class="suggestion-removed"[^>]*aria-label="Removed"[\s\S]*old-text/);
    expect(html).toContain("Outdated");
    expect(html).toMatch(/<\/span>Reject</);
    expect(html).not.toMatch(/<\/span>Approve</);
  });
});
