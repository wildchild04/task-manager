/**
 * The clipboard, as the editor reads and writes it. Everything goes through
 * Markdown: pasted HTML is turned into Markdown here, then into blocks by the
 * same converter agents use.
 */

import { imageFromMarkdown, imageMarkdown } from "~/domain/blocks/markdown";

/** Our own copies: Markdown with mentions and links to pages by their full IDs, so pasting back keeps them exactly. */
export const APP_FORMAT = "application/x-taskhub-markdown";

/** The parts of a DOM node the conversion reads, so it can run on hand-built trees in tests. */
export type DomNode = {
  nodeType: number;
  nodeName: string;
  childNodes: ArrayLike<DomNode>;
  textContent: string | null;
  getAttribute?(name: string): string | null;
};

const TEXT_NODE = 3;
const ELEMENT_NODE = 1;

const BLOCK_ELEMENTS = new Set([
  "P",
  "DIV",
  "SECTION",
  "ARTICLE",
  "MAIN",
  "BODY",
  "HTML",
  "HEADER",
  "FOOTER",
  "ASIDE",
  "NAV",
  "FIGURE",
  "H1",
  "H2",
  "H3",
  "H4",
  "H5",
  "H6",
  "UL",
  "OL",
  "LI",
  "BLOCKQUOTE",
  "PRE",
  "HR",
  "TABLE",
  "THEAD",
  "TBODY",
  "TFOOT",
  "TR",
  "DL",
  "DT",
  "DD",
  "DETAILS",
  "SUMMARY",
]);
const SKIPPED = new Set(["SCRIPT", "STYLE", "TEMPLATE", "HEAD", "META", "LINK", "TITLE", "SVG", "BUTTON", "INPUT"]);

const children = (node: DomNode) => Array.from(node.childNodes);
const attribute = (node: DomNode, name: string) => node.getAttribute?.(name) ?? null;
/** An image stands on its line of its own, and so does whatever holds one (GitHub links its images). */
const holdsImage = (node: DomNode): boolean => node.nodeName === "IMG" || children(node).some(holdsImage);
const isBlock = (node: DomNode) => node.nodeType === ELEMENT_NODE && (BLOCK_ELEMENTS.has(node.nodeName) || holdsImage(node));

/** An image as `![alt](src)`, or nothing when its source can't be an image block (relative, `data:`). */
function image(node: DomNode): string[] {
  const src = attribute(node, "src")?.trim() ?? "";
  const alt = (attribute(node, "alt") ?? "").replace(/\s+/g, " ").trim();
  if (!src || !imageFromMarkdown(src, alt)) return [];
  return [imageMarkdown(alt, src)];
}
const hasBlockChildren = (node: DomNode) => children(node).some(isBlock);

/** Wraps text in a mark, keeping the text's surrounding spaces outside it, and nothing around empty text. */
function wrap(inner: string, open: string, close = open): string {
  const trimmed = inner.trim();
  if (!trimmed) return inner;
  const lead = inner.slice(0, inner.length - inner.trimStart().length);
  const trail = inner.slice(inner.trimEnd().length);
  return `${lead}${open}${trimmed}${close}${trail}`;
}

/** Marks a span carries in its `style`, as rich editors (Google Docs) write them. */
function styledMarks(node: DomNode): { bold: boolean; italic: boolean; strike: boolean; plain: boolean } {
  const style = (attribute(node, "style") ?? "").replace(/\s+/g, "").toLowerCase();
  const weight = /font-weight:(\w+)/.exec(style)?.[1];
  return {
    bold: weight === "bold" || weight === "bolder" || (weight !== undefined && Number(weight) >= 600),
    italic: style.includes("font-style:italic"),
    strike: style.includes("line-through"),
    plain: weight === "normal" || weight === "400",
  };
}

/** Inline content as Markdown: text with marks, links and line breaks. */
function inline(node: DomNode): string {
  if (node.nodeType === TEXT_NODE) return (node.textContent ?? "").replace(/\s+/g, " ");
  if (node.nodeType !== ELEMENT_NODE || SKIPPED.has(node.nodeName)) return "";
  const inner = () => children(node).map(inline).join("");
  switch (node.nodeName) {
    case "BR":
      return "\n";
    case "STRONG":
      return wrap(inner(), "**");
    case "B":
      // Google Docs wraps whole copies in <b style="font-weight:normal">.
      return styledMarks(node).plain ? inner() : wrap(inner(), "**");
    case "EM":
    case "I":
      return wrap(inner(), "*");
    case "S":
    case "DEL":
    case "STRIKE":
      return wrap(inner(), "~~");
    case "U":
      return wrap(inner(), "<u>", "</u>");
    case "CODE":
    case "KBD":
    case "SAMP": {
      const code = node.textContent ?? "";
      return code ? `\`${code}\`` : "";
    }
    case "A": {
      const href = attribute(node, "href");
      const label = inner();
      return href && label.trim() && !href.startsWith("javascript:") ? wrap(label, "[", `](${href})`) : label;
    }
    case "SPAN": {
      const marks = styledMarks(node);
      let text = inner();
      if (marks.bold) text = wrap(text, "**");
      if (marks.italic) text = wrap(text, "*");
      if (marks.strike) text = wrap(text, "~~");
      return text;
    }
    default:
      return inner();
  }
}

/** A run of inline nodes as one paragraph's text, or nothing when it's only whitespace. */
const paragraph = (nodes: DomNode[]) => {
  const text = nodes
    .map(inline)
    .join("")
    .split("\n")
    .map((line) => line.trim())
    .join("\n")
    .trim();
  return text ? [text] : [];
};

/** The language a code block's classes name (`language-ts`, `lang-ts`, GitHub's `highlight-source-ts`). */
function languageOf(...nodes: (DomNode | undefined)[]): string {
  for (const node of nodes) {
    const match = /(?:^|\s)(?:language|lang|highlight-source)-([\w+#-]+)/.exec((node && attribute(node, "class")) ?? "");
    if (match) return match[1]!;
  }
  return "";
}

function codeBlock(pre: DomNode, parent?: DomNode): string {
  const code = children(pre).find((child) => child.nodeName === "CODE");
  const value = (pre.textContent ?? "").replace(/\n$/, "");
  const longest = Math.max(2, ...[...value.matchAll(/`+/g)].map((run) => run[0].length));
  const fence = "`".repeat(longest + 1);
  return `${fence}${languageOf(code, pre, parent)}\n${value}\n${fence}`;
}

function table(node: DomNode): string {
  const rows: DomNode[] = [];
  const collect = (at: DomNode) => {
    for (const child of children(at)) {
      if (child.nodeName === "TR") rows.push(child);
      else if (["THEAD", "TBODY", "TFOOT"].includes(child.nodeName)) collect(child);
    }
  };
  collect(node);
  const cells = rows.map((row) =>
    children(row)
      .filter((cell) => cell.nodeName === "TD" || cell.nodeName === "TH")
      .map((cell) => {
        const value = children(cell).every((c) => !isBlock(c)) ? (paragraph(children(cell))[0] ?? "") : blocks(cell).join("\n");
        return value.replace(/\|/g, "\\|").replace(/\n/g, "<br>");
      }),
  );
  const width = Math.max(1, ...cells.map((row) => row.length));
  const line = (row: string[]) => `| ${Array.from({ length: width }, (_, i) => row[i] ?? "").join(" | ")} |`;
  if (cells.length === 0) return "";
  return [line(cells[0]!), `|${Array.from({ length: width }, () => "---").join("|")}|`, ...cells.slice(1).map(line)].join("\n");
}

/** A list as Markdown lines, nested lists indented under their item. */
function list(node: DomNode, depth: number): string {
  const ordered = node.nodeName === "OL";
  const lines: string[] = [];
  let number = Number(attribute(node, "start") ?? 1) || 1;
  for (const item of children(node).filter((child) => child.nodeName === "LI")) {
    const box = children(item).find((child) => child.nodeName === "INPUT" && attribute(child, "type") === "checkbox");
    const marker = box ? `- [${attribute(box, "checked") !== null ? "x" : " "}] ` : ordered ? `${number++}. ` : "- ";
    const own = children(item).filter((child) => child.nodeName !== "UL" && child.nodeName !== "OL");
    const text =
      (own.some(isBlock)
        ? own.flatMap((child) => (isBlock(child) ? blocks(child) : paragraph([child]))).join(" ")
        : paragraph(own)[0]) ?? "";
    lines.push(`${"  ".repeat(depth)}${marker}${text.replace(/\n/g, " ")}`);
    for (const nested of children(item).filter((child) => child.nodeName === "UL" || child.nodeName === "OL")) {
      lines.push(list(nested, depth + 1));
    }
  }
  return lines.join("\n");
}

/** A node's content as Markdown blocks. */
function blocks(node: DomNode): string[] {
  const out: string[] = [];
  let run: DomNode[] = [];
  const flush = () => {
    out.push(...paragraph(run));
    run = [];
  };
  for (const child of children(node)) {
    if (child.nodeType === ELEMENT_NODE && SKIPPED.has(child.nodeName)) continue;
    if (!isBlock(child)) {
      run.push(child);
      continue;
    }
    flush();
    const name = child.nodeName;
    if (name === "IMG") {
      out.push(...image(child));
    } else if (/^H[1-6]$/.test(name)) {
      const text = paragraph([child])[0];
      if (text) out.push(`${"#".repeat(Number(name[1]))} ${text.replace(/\n/g, " ")}`);
    } else if (name === "UL" || name === "OL") {
      const value = list(child, 0);
      if (value) out.push(value);
    } else if (name === "PRE") {
      out.push(codeBlock(child, node));
    } else if (name === "TABLE") {
      const value = table(child);
      if (value) out.push(value);
    } else if (name === "HR") {
      out.push("---");
    } else if (name === "BLOCKQUOTE") {
      const inner = blocks(child).join("\n");
      if (inner)
        out.push(
          inner
            .split("\n")
            .map((line) => `> ${line}`)
            .join("\n"),
        );
    } else if (hasBlockChildren(child)) {
      out.push(...blocks(child));
    } else {
      out.push(...paragraph(children(child)));
    }
  }
  flush();
  return out;
}

/** Pasted HTML as Markdown: the blocks and marks the editor knows, other elements by their text. */
export function htmlToMarkdown(root: DomNode): string {
  return blocks(root).join("\n\n");
}
