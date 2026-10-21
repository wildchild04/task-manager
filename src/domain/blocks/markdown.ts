import { CONTENT_ID_PATTERN } from "../content/content.repository";
import { isHttpUrl } from "./schema";
import type { BlockType, CalloutTone, ImageProps, Mark, NewBlock, RichText, SimpleMark, TextSpan, TreeNode } from "./types";
import { MAX_IMAGE_ALT, MAX_IMAGE_URL, MENTION_TEXT } from "./types";

/**
 * Blocks as Markdown and back, for agents. The subset is small and line based:
 * one block per line (paragraphs may span lines), nesting by two spaces per
 * level, and inline marks, links and mentions; tables (GFM pipe tables) and
 * code (fences) span several lines. Anything it can't parse stays as plain
 * text, and the constructs it recognizes but doesn't support are reported.
 */

/** What reading needs to know about targets outside the blocks being read. */
export type MarkdownReader = {
  /** What a mention of this page stands for, or `null` when it's gone. `id` is written as is. */
  mentionTarget(pageId: string): { kind: "page" | "task"; id: string; title: string } | null;
  /** What a reference block points at. */
  referenceTarget(targetId: string): { kind: "page"; id: string; title: string } | { kind: "block"; text: string } | null;
  /** How an app link (`/pages/:id`, `/tasks/:id`) is written: `page:<id>` / `task:<id>`, or `undefined` to keep the URL. */
  appLink(href: string): string | undefined;
  /** How a sub-page's ID is written. */
  pageId(id: string): string;
  /** The URL an uploaded image is written with (absolute for agents and other apps). */
  contentUrl(id: string): string;
  /** When given, each block's first line ends with ` ^` and this (the block's anchor). */
  anchor?(id: string): string;
  /** A pending suggestion's attributes (`id`, `by`, `action`, `target`, `status`, `note`), written on its tag line. */
  suggestion?(id: string): Record<string, string | undefined> | null;
};

/** A trailing block anchor, as written by `anchor`. */
const ANCHOR = / \^[\w-]{8}$/;

/** A suggestion's tag line, which agents read but can't write. */
export const SUGGESTION_TAG = /^\s*<\/?suggestion\b/m;

const attribute = (value: string) => value.replace(/&/g, "&amp;").replace(/"/g, "&quot;").replace(/\n/g, " ");

/** What writing needs: targets an agent names as `page:<id>` or `task:<id>`. */
export type MarkdownWriter = {
  /** The page a mention points at (a task's description page for a task) and the app link, or `null` if not found. */
  findTarget(kind: "page" | "task", id: string): { pageId: string; href: string } | null;
  newId(): string;
};

// ----- Reading -----

const isLink = (mark: Mark): mark is { type: "link"; href: string } => typeof mark === "object";

/** How each mark opens and closes; a link closes with its target. */
const MARK_SYNTAX: Record<SimpleMark, string> = { bold: "**", italic: "*", strikethrough: "~~", code: "`", underline: "<u>" };
const closing = (mark: string) => (mark === "<u>" ? "</u>" : mark);

/** Marks a new span opens, outermost first, as the writer has always nested them: link, underline, strikethrough, italic, bold, code. */
const OPEN_ORDER = ["link", "underline", "strikethrough", "italic", "bold", "code"] as const;

/**
 * Rich text as inline Markdown. Marks shared by consecutive spans are opened
 * once around all of them (`**a `b` c**`, not `**a ****`b`**** c**`): marks
 * already open stay outermost, the others open inside them, and inline code
 * is always innermost, since nothing can be nested in backticks.
 */
function inlineToMarkdown(content: RichText, reader: MarkdownReader): string {
  type Open = { key: string; close: string };
  const stack: Open[] = [];
  let out = "";
  const closeFrom = (index: number) => {
    while (stack.length > index) out += stack.pop()!.close;
  };
  for (const span of content) {
    const marks = span.marks ?? [];
    const link = marks.find(isLink);
    const wanted = new Map<string, { open: string; close: string }>();
    for (const name of OPEN_ORDER) {
      if (name === "link") {
        if (link) wanted.set(`link:${link.href}`, { open: "[", close: `](${reader.appLink(link.href) ?? link.href})` });
      } else if (marks.includes(name)) {
        wanted.set(name, { open: MARK_SYNTAX[name], close: closing(MARK_SYNTAX[name]) });
      }
    }
    // Keep the open marks this span still has, up to the first it doesn't.
    let kept = 0;
    while (kept < stack.length && wanted.has(stack[kept]!.key)) kept++;
    const opening = [...wanted.keys()].filter((key) => !stack.slice(0, kept).some((open) => open.key === key));
    // Code stays innermost: close it before opening anything else.
    if (opening.length > 0 && kept > 0 && stack[kept - 1]!.key === "code") kept--;
    closeFrom(kept);
    for (const key of [...wanted.keys()].filter((k) => !stack.some((open) => open.key === k))) {
      const { open, close } = wanted.get(key)!;
      out += open;
      stack.push({ key, close });
    }
    if (span.mention) {
      const target = reader.mentionTarget(span.mention.pageId);
      out += target ? `@[${target.title}](${target.kind}:${target.id})` : "@[missing page]";
    } else {
      out += span.text;
    }
  }
  closeFrom(0);
  return out;
}

const LIST_TYPES: readonly BlockType[] = ["bulleted_list_item", "numbered_list_item", "todo"];

/** GitHub alert markers for callout tones, and the emoji a callout gets when an agent writes none. */
const CALLOUT_MARKERS: Record<CalloutTone, string> = {
  default: "NOTE",
  success: "TIP",
  info: "IMPORTANT",
  warning: "WARNING",
  error: "CAUTION",
};
const CALLOUT_EMOJI: Record<CalloutTone, string> = { default: "💡", success: "✅", info: "ℹ️", warning: "⚠️", error: "🛑" };

const plainOf = (content: RichText) => content.map((span) => span.text).join("");

/** A table cell's inline Markdown: a pipe would end the cell and a line break the row. */
const cellMarkdown = (content: RichText, reader: MarkdownReader) =>
  inlineToMarkdown(content, reader).replace(/\|/g, "\\|").replace(/\n/g, "<br>");

/** A GFM pipe table: the header row (empty when the table has none), the separator row, then the rows. */
function tableLines(node: TreeNode, reader: MarkdownReader): string[] {
  const rows = (node.children ?? []).map((row) => (row.children ?? []).map((cell) => cellMarkdown(cell.block.content, reader)));
  const width = rows[0]?.length ?? 0;
  const line = (cells: readonly string[]) => `| ${cells.join(" | ")} |`;
  const headerRow = (node.block.props as { headerRow?: boolean }).headerRow !== false;
  const header = headerRow ? rows[0]! : Array<string>(width).fill("");
  return [line(header), `|${Array<string>(width).fill("---").join("|")}|`, ...(headerRow ? rows.slice(1) : rows).map(line)];
}

/** A code fence: its text verbatim, between fences longer than any run of backticks inside. */
function codeLines(text: string, language: string): string[] {
  const longest = Math.max(0, ...(text.match(/`+/g) ?? []).map((run) => run.length));
  const fence = "`".repeat(Math.max(3, longest + 1));
  return [`${fence}${language}`, ...(text ? text.split("\n") : []), fence];
}

/** The Markdown lines of one block (without its children), given its number in a numbered list. */
function blockLines(node: TreeNode, reader: MarkdownReader, number: number): string[] {
  const { type, props, content } = node.block;
  const text = inlineToMarkdown(content, reader);
  switch (type) {
    case "heading":
      return [`${"#".repeat((props as { level?: number }).level ?? 1)} ${text}`];
    case "table":
      return tableLines(node, reader);
    case "code":
      return codeLines(plainOf(content), (props as { language?: string }).language ?? "");
    case "callout": {
      const { emoji, tone } = props as { emoji: string; tone: CalloutTone };
      const [first = "", ...rest] = text.split("\n");
      return [`> [!${CALLOUT_MARKERS[tone]}] ${emoji}${first ? ` ${first}` : ""}`, ...rest.map((line) => `> ${line}`)];
    }
    case "bulleted_list_item":
      return [`- ${text}`];
    case "numbered_list_item":
      return [`${number}. ${text}`];
    case "todo":
      return [`- [${(props as { checked?: boolean }).checked ? "x" : " "}] ${text}`];
    case "quote":
      return text.split("\n").map((line) => `> ${line}`);
    case "divider":
      return ["---"];
    case "image": {
      const image = props as ImageProps;
      const src = "contentId" in image ? reader.contentUrl(image.contentId) : image.url;
      return [imageMarkdown(image.alt, src)];
    }
    case "toggle":
      return [`▸ ${text}`];
    case "page":
      return [`[${text || "Untitled"}](page:${reader.pageId(node.block.id)})`];
    case "reference": {
      const target = reader.referenceTarget((props as { targetId: string }).targetId);
      if (!target) return ["(missing reference)"];
      if (target.kind === "page") return [`[${target.title || "Untitled"}](page:${target.id})`];
      return target.text.split("\n").map((line) => `> ${line}`);
    }
    default:
      return text.split("\n");
  }
}

/** A suggestion as a tag line, its proposed blocks at the same depth, and a closing tag line. */
function suggestionMarkdown(node: TreeNode, reader: MarkdownReader, depth: number): string {
  const indent = "  ".repeat(depth);
  const attributes = Object.entries(reader.suggestion?.(node.block.id) ?? {})
    .filter((entry): entry is [string, string] => entry[1] !== undefined)
    .map(([name, value]) => ` ${name}="${attribute(value)}"`)
    .join("");
  const children = node.children?.length ? toMarkdown(node.children, reader, depth) : "";
  return [`${indent}<suggestion${attributes}>`, children, `${indent}</suggestion>`].filter(Boolean).join("\n");
}

/** Blocks (a page's or comment's children) as Markdown. */
export function toMarkdown(nodes: readonly TreeNode[], reader: MarkdownReader, depth = 0): string {
  const indent = "  ".repeat(depth);
  const parts: string[] = [];
  let previous: BlockType | undefined;
  let number = 0;
  for (const node of nodes) {
    const type = node.block.type;
    number = type === "numbered_list_item" ? (previous === "numbered_list_item" ? number + 1 : 1) : 0;
    let text: string;
    if (type === "suggestion") {
      text = suggestionMarkdown(node, reader, depth);
    } else {
      const lines = blockLines(node, reader, number).map((line) => indent + line);
      if (reader.anchor) lines[0] += ` ^${reader.anchor(node.block.id)}`;
      // A table's rows and cells are its own lines.
      const children = node.children?.length && type !== "table" ? toMarkdown(node.children, reader, depth + 1) : "";
      text = [lines.join("\n"), children].filter(Boolean).join("\n");
    }
    // List items stay together; everything else is separated by a blank line.
    const together = previous !== undefined && LIST_TYPES.includes(previous) && LIST_TYPES.includes(type);
    parts.push(parts.length === 0 ? text : `${together ? "\n" : "\n\n"}${text}`);
    previous = type;
  }
  return parts.join("");
}

// ----- Images -----

/** An image's line: alt text escaped and on one line, and the few URL characters Markdown can't hold percent-encoded. */
export function imageMarkdown(alt: string, src: string): string {
  const text = alt.replace(/[\\[\]]/g, "\\$&").replace(/\s*\n\s*/g, " ");
  const url = src.replace(/[()\s<>]/g, (char) => `%${char.charCodeAt(0).toString(16).toUpperCase().padStart(2, "0")}`);
  return `![${text}](${url})`;
}

/** A line that is only an image: `![alt](src)`, optionally with a title (ignored). */
const IMAGE_LINE = /^!\[((?:[^\]\\]|\\.)*)\]\(\s*<?([^\s()<>]+)>?(?:\s+"[^"]*")?\s*\)$/;
const INLINE_IMAGE = /!\[[^\]]*\]\([^)]*\)/g;

/** An uploaded item's URL, relative or absolute: anything ending in `/content/<id>`. */
const CONTENT_URL = /(?:^|\/)content\/([^/?#]+)(?:[?#].*)?$/;

/** An image's props from its Markdown source, or `null` when it can't be one. */
export function imageFromMarkdown(src: string, alt: string): ImageProps | null {
  alt = alt.replace(/\\(.)/g, "$1").slice(0, MAX_IMAGE_ALT);
  const uploaded = CONTENT_URL.exec(src)?.[1];
  if (uploaded && CONTENT_ID_PATTERN.test(uploaded) && (src.startsWith("/") || src.startsWith("content/") || isHttpUrl(src)))
    return { contentId: uploaded, alt };
  if (isHttpUrl(src) && src.length <= MAX_IMAGE_URL) return { url: src, alt };
  return null;
}

// ----- Writing -----

const INLINE_PATTERNS: { kind: string; pattern: RegExp }[] = [
  { kind: "code", pattern: /`([^`]+)`/ },
  { kind: "mention", pattern: /@\[([^\]]*)\]\((task|page):([^)\s]+)\)/ },
  { kind: "link", pattern: /\[([^\]]+)\]\(([^)\s]+)\)/ },
  { kind: "bold", pattern: /\*\*(.+?)\*\*/ },
  { kind: "strikethrough", pattern: /~~(.+?)~~/ },
  { kind: "underline", pattern: /<u>(.+?)<\/u>/ },
  { kind: "italic", pattern: /\*([^*\s][^*]*?)\*/ },
];

function withMark(marks: readonly Mark[], mark: Mark): Mark[] {
  return [...marks, mark];
}

const span = (text: string, marks: readonly Mark[]): TextSpan => (marks.length > 0 ? { text, marks: [...marks] } : { text });

/** Inline Markdown as rich text: marks, links (app links to pages and tasks resolved) and mentions. */
export function fromInlineMarkdown(text: string, writer: MarkdownWriter, marks: readonly Mark[] = []): RichText {
  const out: TextSpan[] = [];
  let rest = text;
  while (rest.length > 0) {
    let best: { kind: string; match: RegExpExecArray } | undefined;
    for (const { kind, pattern } of INLINE_PATTERNS) {
      const match = pattern.exec(rest);
      if (match && (!best || match.index < best.match.index)) best = { kind, match };
    }
    if (!best) {
      out.push(span(rest, marks));
      break;
    }
    const { kind, match } = best;
    if (match.index > 0) out.push(span(rest.slice(0, match.index), marks));
    switch (kind) {
      case "code":
        out.push(span(match[1]!, withMark(marks, "code")));
        break;
      case "mention": {
        const target = writer.findTarget(match[2] as "page" | "task", match[3]!);
        if (target) {
          const kept = marks.filter((m) => !isLink(m));
          out.push({ text: MENTION_TEXT, mention: { pageId: target.pageId }, ...(kept.length ? { marks: kept } : {}) });
        } else {
          out.push(span(match[0], marks));
        }
        break;
      }
      case "link": {
        const app = /^(page|task):(.+)$/.exec(match[2]!);
        const href = app ? writer.findTarget(app[1] as "page" | "task", app[2]!)?.href : match[2];
        out.push(
          ...(href ? fromInlineMarkdown(match[1]!, writer, withMark(marks, { type: "link", href })) : [span(match[0], marks)]),
        );
        break;
      }
      default:
        out.push(...fromInlineMarkdown(match[1]!, writer, withMark(marks, kind as Mark)));
    }
    rest = rest.slice(match.index + match[0].length);
  }
  return mergeSpans(out);
}

function sameMarks(a: readonly Mark[] = [], b: readonly Mark[] = []): boolean {
  const key = (m: Mark) => (isLink(m) ? `link:${m.href}` : m);
  return a.length === b.length && a.map(key).sort().join() === b.map(key).sort().join();
}

function mergeSpans(spans: TextSpan[]): RichText {
  const out: TextSpan[] = [];
  for (const s of spans) {
    if (s.text === "") continue;
    const last = out.at(-1);
    if (last && !last.mention && !s.mention && sameMarks(last.marks, s.marks))
      out[out.length - 1] = { ...last, text: last.text + s.text };
    else out.push(s);
  }
  return out;
}

/** A block written from Markdown, with its nested blocks. */
export type MarkdownBlock = NewBlock & { children?: MarkdownBlock[] };

type Line = { depth: number; type: BlockType; props: Record<string, unknown>; text: string };

const CALLOUT_TONE_OF: Record<string, CalloutTone> = Object.fromEntries(
  Object.entries(CALLOUT_MARKERS).map(([tone, marker]) => [marker, tone as CalloutTone]),
);

/** A callout's line: its tone, and its emoji (right after the marker, or the tone's default) and text. */
function calloutLine(depth: number, marker: string, rest: string): Line {
  const tone = CALLOUT_TONE_OF[marker.toUpperCase()]!;
  const first = [...new Intl.Segmenter().segment(rest)][0]?.segment;
  const hasEmoji = first !== undefined && /\p{Extended_Pictographic}/u.test(first);
  return {
    depth,
    type: "callout",
    props: { emoji: hasEmoji ? first : CALLOUT_EMOJI[tone], tone },
    text: hasEmoji ? rest.slice(first.length).trimStart() : rest,
  };
}

/** What one line is: its block type, props and the text after the marker. */
function parseLine(raw: string): Line | null {
  const spaces = raw.length - raw.trimStart().length;
  const line = raw.trim();
  if (line === "") return null;
  const depth = Math.floor(spaces / 2);
  let m: RegExpExecArray | null;
  if ((m = /^(#{1,6}) (.*)$/.exec(line))) return { depth, type: "heading", props: { level: m[1]!.length }, text: m[2]! };
  if ((m = /^[-*] \[( |x|X)\] (.*)$/.exec(line))) return { depth, type: "todo", props: { checked: m[1] !== " " }, text: m[2]! };
  if ((m = /^[-*] (.*)$/.exec(line))) return { depth, type: "bulleted_list_item", props: {}, text: m[1]! };
  if ((m = /^\d+\. (.*)$/.exec(line))) return { depth, type: "numbered_list_item", props: {}, text: m[1]! };
  if ((m = /^> ?\[!(NOTE|TIP|IMPORTANT|WARNING|CAUTION)\][ \t]*(.*)$/i.exec(line))) return calloutLine(depth, m[1]!, m[2]!);
  if ((m = /^> ?(.*)$/.exec(line))) return { depth, type: "quote", props: {}, text: m[1]! };
  if (/^(-{3,}|\*{3,})$/.test(line)) return { depth, type: "divider", props: {}, text: "" };
  return { depth, type: "paragraph", props: {}, text: line };
}

// ----- Tables and fences -----

const depthOf = (raw: string) => Math.floor((raw.length - raw.trimStart().length) / 2);
const isTableRow = (raw: string) => /^\|.*\|$/.test(raw.trim());
const isDelimiterRow = (raw: string) => /^\|(\s*:?-+:?\s*\|)+$/.test(raw.trim());
const FENCE = /^(\s*)(`{3,})([^`]*)$/;

/** A row's cells: split on pipes that aren't escaped, then `\|` and `<br>` back to a pipe and a line break. */
function cellsOf(raw: string): string[] {
  return raw
    .trim()
    .slice(1, -1)
    .split(/(?<!\\)\|/)
    .map((cell) =>
      cell
        .trim()
        .replace(/\\\|/g, "|")
        .replace(/<br\s*\/?>/gi, "\n"),
    );
}

/** A table from its header and body rows: rows padded or cut to the header's width; an all-empty header means none. */
function tableBlock(header: string[], body: string[][], writer: MarkdownWriter): MarkdownBlock {
  const headerRow = header.some((cell) => cell !== "");
  const row = (cells: string[]): MarkdownBlock => ({
    id: writer.newId(),
    type: "table_row",
    children: header.map((_, i) => ({
      id: writer.newId(),
      type: "table_cell",
      content: fromInlineMarkdown(cells[i] ?? "", writer),
    })),
  });
  return {
    id: writer.newId(),
    type: "table",
    props: { headerRow, headerColumn: false },
    children: (headerRow ? [header, ...body] : body).map(row),
  };
}

// ----- Warnings -----

/** Recognizable Markdown that isn't supported, on one line, for the agent that wrote it. */
function lineWarnings(raw: string, number: number, allowedTags: readonly string[]): string[] {
  const text = raw.replace(/`[^`]*`/g, "");
  const warnings: string[] = [];
  for (const _image of text.matchAll(INLINE_IMAGE)) warnings.push(`Line ${number}: images must be on a line of their own; kept as text`);
  for (const _note of text.matchAll(/\[\^[^\]]+\]/g)) warnings.push(`Line ${number}: footnotes aren't supported; kept as text`);
  // One warning per element: its opening tag.
  for (const tag of text.matchAll(/<([a-zA-Z][\w-]*)\b[^>]*>/g)) {
    if (!allowedTags.includes(tag[1]!.toLowerCase()))
      warnings.push(`Line ${number}: HTML (<${tag[1]}>) isn't supported; kept as text`);
  }
  return warnings;
}

// ----- The guide for agents -----

/**
 * What agents may write, for `GET markdown`: each block the importer creates,
 * with its syntax and an example (tested to read back as that block), the
 * inline syntax, and what isn't supported.
 */
export const MARKDOWN_GUIDE = {
  blocks: [
    {
      type: "paragraph",
      markdown: "Plain lines; consecutive lines are one paragraph, a blank line ends it",
      example: "Ship the editor v1.",
    },
    { type: "heading", markdown: "`#` to `######` and a space (levels 1–6)", example: "## Goals" },
    { type: "bulleted_list_item", markdown: "`- ` or `* `; indent two spaces to nest", example: "- Tables" },
    { type: "numbered_list_item", markdown: "`1. `; indent two spaces to nest", example: "1. First step" },
    { type: "todo", markdown: "`- [ ] ` open, `- [x] ` done", example: "- [ ] Tag the release" },
    { type: "quote", markdown: "`> ` on each line", example: "> Quoted text" },
    { type: "divider", markdown: "`---` alone on a line", example: "---" },
    {
      type: "image",
      markdown:
        "`![alt text](https://…)` alone on a line: an http(s) URL, or the URL of an image uploaded to the app (as pages read). Images can't be inside a line of text",
      example: "![Latency p95](https://grafana.example/render/p95.png)",
    },
    {
      type: "table",
      markdown:
        "GFM pipe table: a header row, a `|---|` separator row, then rows. `\\|` for a pipe and `<br>` for a line break in a cell; an all-empty header row means no header",
      example: "| Subtopic | Rating |\n|---|---|\n| DNS | 🟡 **Shaky** |",
    },
    {
      type: "code",
      markdown: "A ``` fence with a language, the text verbatim, and a closing fence",
      example: "```sh\nstrace -f ./server\n```",
    },
    {
      type: "callout",
      markdown:
        "GitHub alert syntax: `> [!NOTE]`, `[!TIP]`, `[!IMPORTANT]`, `[!WARNING]` or `[!CAUTION]` (tones default, success, info, warning, error), then an emoji and the text; more `> ` lines continue it, indented blocks nest inside",
      example: "> [!WARNING] ⚠️ Back up the database first",
    },
  ],
  inline: [
    { name: "bold", markdown: "**text**" },
    { name: "italic", markdown: "*text*" },
    { name: "strikethrough", markdown: "~~text~~" },
    { name: "code", markdown: "`text`" },
    { name: "underline", markdown: "<u>text</u>" },
    { name: "link", markdown: "[text](https://…), or [text](page:id) / [text](task:id) to link inside the app" },
    { name: "mention", markdown: "@[Title](page:id) or @[Title](task:id)" },
  ],
  unsupported: [
    { name: "Images without an http(s) URL", markdown: "![alt](chart.png) or ![alt](data:…)", kept: "as text, with a warning" },
    { name: "Images inside text", markdown: "See ![icon](https://…) here", kept: "as text, with a warning" },
    { name: "HTML", markdown: "<div>…</div> (anything but <u>, and <br> in table cells)", kept: "as text, with a warning" },
    { name: "Footnotes", markdown: "[^1]", kept: "as text, with a warning" },
    { name: "Tables without a separator row", markdown: "| a | b | with no |---| under it", kept: "as text, with a warning" },
    { name: "Column alignment", markdown: "|:---:|", kept: "accepted and ignored" },
    { name: "Blocks inside table cells", markdown: "lists or code in a cell", kept: "as the cell's text" },
    { name: "Toggles", markdown: "▸ title (how toggles read)", kept: "as a paragraph" },
  ],
} as const;

// ----- Writing blocks -----

/** Types that can't hold the blocks written under them; those go to the nearest block that can. */
const NO_CHILDREN: readonly BlockType[] = ["divider", "code", "table", "image"];

/**
 * Markdown as blocks. Consecutive lines of a paragraph (or a quote, or a
 * callout's `>` lines) at the same depth are one block; deeper lines nest under
 * the block before them. Fenced code and pipe tables are read first, as whole
 * blocks. Unsupported constructs stay as text and, when `warnings` is given,
 * are reported there by line.
 */
export function fromMarkdown(markdown: string, writer: MarkdownWriter, warnings?: string[]): MarkdownBlock[] {
  const lines = markdown.replace(/\r\n?/g, "\n").split("\n");
  const roots: MarkdownBlock[] = [];
  // The last block at each depth, to nest under and to continue paragraphs. Code and tables already have their content.
  const stack: { depth: number; block: MarkdownBlock; type: BlockType; text: string; done: boolean }[] = [];
  let continuing = false;

  const close = (entry: (typeof stack)[number]) => {
    if (!entry.done) entry.block.content = entry.type === "divider" ? [] : fromInlineMarkdown(entry.text, writer);
  };
  const place = (depth: number, block: MarkdownBlock, text: string, done: boolean) => {
    while (stack.length > 0 && stack.at(-1)!.depth >= depth) close(stack.pop()!);
    const parent = stack.findLast((entry) => !NO_CHILDREN.includes(entry.type));
    if (parent) (parent.block.children ??= []).push(block);
    else roots.push(block);
    stack.push({ depth, block, type: block.type, text, done });
  };

  for (let i = 0; i < lines.length; i++) {
    // Anchors name blocks when reading; Markdown read with them and written back doesn't keep them.
    const raw = lines[i]!.replace(ANCHOR, "");

    const fence = FENCE.exec(raw);
    if (fence) {
      const closing = new RegExp(`^\\s*\`{${fence[2]!.length},}\\s*$`);
      const end = lines.findIndex((line, j) => j > i && closing.test(line));
      if (end >= 0) {
        // The text is kept verbatim, less the fence's own indentation.
        const indent = fence[1]!.length;
        const text = lines
          .slice(i + 1, end)
          .map((line) => line.slice(Math.min(indent, line.length - line.trimStart().length)))
          .join("\n");
        const block: MarkdownBlock = {
          id: writer.newId(),
          type: "code",
          props: { language: fence[3]!.trim().slice(0, 32) },
          content: text ? [{ text }] : [],
        };
        place(depthOf(raw), block, "", true);
        continuing = false;
        i = end;
        continue;
      }
      warnings?.push(`Line ${i + 1}: this code fence is never closed; kept as text`);
    }

    if (isTableRow(raw) && i + 1 < lines.length && isDelimiterRow(lines[i + 1]!)) {
      warnings?.push(...lineWarnings(raw, i + 1, ["u", "br"]));
      const body: string[][] = [];
      let j = i + 2;
      for (; j < lines.length && isTableRow(lines[j]!); j++) {
        warnings?.push(...lineWarnings(lines[j]!, j + 1, ["u", "br"]));
        body.push(cellsOf(lines[j]!));
      }
      place(depthOf(raw), tableBlock(cellsOf(raw), body, writer), "", true);
      continuing = false;
      i = j - 1;
      continue;
    }
    const image = IMAGE_LINE.exec(raw.trim());
    if (image) {
      const props = imageFromMarkdown(image[2]!, image[1]!);
      if (props) {
        place(depthOf(raw), { id: writer.newId(), type: "image", props }, "", true);
        continuing = false;
        continue;
      }
    }
    if (warnings) {
      if (isTableRow(raw) && !(i > 0 && isTableRow(lines[i - 1]!)))
        warnings.push(`Line ${i + 1}: a table needs a separator row (|---|) under its header; kept as text`);
      if (image) warnings.push(`Line ${i + 1}: images need an http(s) URL or an uploaded image; kept as text`);
      warnings.push(...lineWarnings(image ? "" : raw, i + 1, ["u"]));
    }

    const line = parseLine(raw);
    if (!line) {
      continuing = false;
      continue;
    }
    const top = stack.at(-1);
    // A plain line right after a paragraph or quote line at the same depth continues it; so do `>` lines after a callout.
    if (continuing && top && top.depth === line.depth) {
      const paragraphOrQuote =
        (line.type === "paragraph" || line.type === top.type) && (top.type === "paragraph" || top.type === "quote");
      if (paragraphOrQuote || (top.type === "callout" && line.type === "quote")) {
        top.text = top.text ? `${top.text}\n${line.text}` : line.text;
        continue;
      }
    }
    place(line.depth, { id: writer.newId(), type: line.type, props: line.props }, line.text, false);
    continuing = true;
  }
  for (const entry of stack) close(entry);
  return roots;
}
