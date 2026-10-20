import { describe, expect, it } from "vitest";

import { type DomNode, htmlToMarkdown } from "../../app/editor/clipboard";

/** A hand-built element: the parts of the DOM the conversion reads. */
function el(name: string, attrs: Record<string, string> | DomNode | string = {}, ...kids: (DomNode | string)[]): DomNode {
  const attributes = typeof attrs === "object" && !("nodeType" in attrs) ? attrs : {};
  const all = [...(typeof attrs === "object" && !("nodeType" in attrs) ? [] : [attrs as DomNode | string]), ...kids].map(
    (kid): DomNode => (typeof kid === "string" ? text(kid) : kid),
  );
  return {
    nodeType: 1,
    nodeName: name.toUpperCase(),
    childNodes: all,
    get textContent() {
      return all.map((kid) => kid.textContent ?? "").join("");
    },
    getAttribute: (key) => attributes[key] ?? null,
  };
}
const text = (value: string): DomNode => ({ nodeType: 3, nodeName: "#text", childNodes: [], textContent: value });
const body = (...kids: (DomNode | string)[]) => el("body", {}, ...kids);

describe("pasted HTML as Markdown", () => {
  it("converts paragraphs, headings, marks and links", () => {
    const html = body(
      el("h2", "Install"),
      "\n  ",
      el("p", "Run ", el("code", "npm i"), " then ", el("strong", "restart"), ", see ", el("a", { href: "https://x.dev" }, "the docs"), "."),
      el("p", el("em", "Note:"), " old ", el("del", "way"), el("br"), "second line"),
    );
    expect(htmlToMarkdown(html)).toBe(
      "## Install\n\nRun `npm i` then **restart**, see [the docs](https://x.dev).\n\n*Note:* old ~~way~~\nsecond line",
    );
  });

  it("converts nested lists, numbered lists and checkboxes", () => {
    const html = body(
      el("ul", el("li", "one", el("ul", el("li", "nested"))), el("li", el("strong", "two"))),
      el("ol", { start: "3" }, el("li", "third"), el("li", "fourth")),
      el("ul", el("li", el("input", { type: "checkbox", checked: "" }), " done"), el("li", el("input", { type: "checkbox" }), " todo")),
    );
    expect(htmlToMarkdown(html)).toBe("- one\n  - nested\n- **two**\n\n3. third\n4. fourth\n\n- [x] done\n- [ ] todo");
  });

  it("converts GitHub code blocks with their language, and tables", () => {
    const html = body(
      el("div", { class: "highlight highlight-source-ts" }, el("pre", "let x = 1;\nconsole.log(`x`);\n")),
      el(
        "table",
        el("thead", el("tr", el("th", "Name"), el("th", "Value"))),
        el("tbody", el("tr", el("td", "pipe"), el("td", "a | b")), el("tr", el("td", el("strong", "bold")))),
      ),
    );
    expect(htmlToMarkdown(html)).toBe(
      "```ts\nlet x = 1;\nconsole.log(`x`);\n```\n\n| Name | Value |\n|---|---|\n| pipe | a \\| b |\n| **bold** |  |",
    );
  });

  it("reads Google Docs' wrapper as plain and its styled spans as marks", () => {
    const html = body(
      el(
        "b",
        { style: "font-weight:normal;", id: "docs-internal-guid-1" },
        el("p", el("span", { style: "font-weight:700" }, "Bold"), el("span", " and "), el("span", { style: "font-style:italic" }, "italic")),
      ),
    );
    expect(htmlToMarkdown(html)).toBe("**Bold** and *italic*");
  });

  it("skips images, scripts and empty elements, keeping quotes and dividers", () => {
    const html = body(el("img", { src: "x.png" }), el("script", "alert(1)"), el("blockquote", el("p", "Quoted")), el("hr"), el("p", "  "));
    expect(htmlToMarkdown(html)).toBe("> Quoted\n\n---");
  });
});
