import type { BlockType, Mark, NewBlock, RichText, TextSpan, TreeNode } from "./types";
import { MENTION_TEXT } from "./types";

/**
 * Blocks as Markdown and back, for agents. The subset is small and line based:
 * one block per line (paragraphs may span lines), nesting by two spaces per
 * level, and inline marks, links and mentions. Anything it can't parse stays
 * as plain text.
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
};

/** What writing needs: targets an agent names as `page:<id>` or `task:<id>`. */
export type MarkdownWriter = {
  /** The page a mention points at (a task's description page for a task) and the app link, or `null` if not found. */
  findTarget(kind: "page" | "task", id: string): { pageId: string; href: string } | null;
  newId(): string;
};

// ----- Reading -----

const isLink = (mark: Mark): mark is { type: "link"; href: string } => typeof mark === "object";

function inlineToMarkdown(content: RichText, reader: MarkdownReader): string {
  return content
    .map((span) => {
      let text: string;
      if (span.mention) {
        const target = reader.mentionTarget(span.mention.pageId);
        text = target ? `@[${target.title}](${target.kind}:${target.id})` : "@[missing page]";
      } else {
        text = span.text;
      }
      const marks = span.marks ?? [];
      if (marks.includes("code")) text = `\`${text}\``;
      if (marks.includes("bold")) text = `**${text}**`;
      if (marks.includes("italic")) text = `*${text}*`;
      if (marks.includes("strikethrough")) text = `~~${text}~~`;
      if (marks.includes("underline")) text = `<u>${text}</u>`;
      const link = marks.find(isLink);
      if (link) text = `[${text}](${reader.appLink(link.href) ?? link.href})`;
      return text;
    })
    .join("");
}

const LIST_TYPES: readonly BlockType[] = ["bulleted_list_item", "numbered_list_item", "todo"];

/** The Markdown lines of one block (without its children), given its number in a numbered list. */
function blockLines(node: TreeNode, reader: MarkdownReader, number: number): string[] {
  const { type, props, content } = node.block;
  const text = inlineToMarkdown(content, reader);
  switch (type) {
    case "heading":
      return [`${"#".repeat((props as { level?: number }).level ?? 1)} ${text}`];
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

/** Blocks (a page's or comment's children) as Markdown. */
export function toMarkdown(nodes: readonly TreeNode[], reader: MarkdownReader, depth = 0): string {
  const indent = "  ".repeat(depth);
  const parts: string[] = [];
  let previous: BlockType | undefined;
  let number = 0;
  for (const node of nodes) {
    const type = node.block.type;
    number = type === "numbered_list_item" ? (previous === "numbered_list_item" ? number + 1 : 1) : 0;
    const lines = blockLines(node, reader, number).map((line) => indent + line);
    const children = node.children?.length ? toMarkdown(node.children, reader, depth + 1) : "";
    const text = [lines.join("\n"), children].filter(Boolean).join("\n");
    // List items stay together; everything else is separated by a blank line.
    const together = previous !== undefined && LIST_TYPES.includes(previous) && LIST_TYPES.includes(type);
    parts.push(parts.length === 0 ? text : `${together ? "\n" : "\n\n"}${text}`);
    previous = type;
  }
  return parts.join("");
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

/** What one line is: its block type, props and the text after the marker. */
function parseLine(raw: string): Line | null {
  const spaces = raw.length - raw.trimStart().length;
  const line = raw.trim();
  if (line === "") return null;
  const depth = Math.floor(spaces / 2);
  let m: RegExpExecArray | null;
  if ((m = /^(#{1,3}) (.*)$/.exec(line))) return { depth, type: "heading", props: { level: m[1]!.length }, text: m[2]! };
  if ((m = /^[-*] \[( |x|X)\] (.*)$/.exec(line))) return { depth, type: "todo", props: { checked: m[1] !== " " }, text: m[2]! };
  if ((m = /^[-*] (.*)$/.exec(line))) return { depth, type: "bulleted_list_item", props: {}, text: m[1]! };
  if ((m = /^\d+\. (.*)$/.exec(line))) return { depth, type: "numbered_list_item", props: {}, text: m[1]! };
  if ((m = /^> ?(.*)$/.exec(line))) return { depth, type: "quote", props: {}, text: m[1]! };
  if (/^(-{3,}|\*{3,})$/.test(line)) return { depth, type: "divider", props: {}, text: "" };
  return { depth, type: "paragraph", props: {}, text: line };
}

/**
 * Markdown as blocks. Consecutive lines of a paragraph (or a quote) at the
 * same depth are one block; deeper lines nest under the block before them.
 */
export function fromMarkdown(markdown: string, writer: MarkdownWriter): MarkdownBlock[] {
  const roots: MarkdownBlock[] = [];
  // The last block at each depth, to nest under and to continue paragraphs.
  const stack: { depth: number; block: MarkdownBlock; type: BlockType; text: string }[] = [];
  let continuing = false;

  const finish = () => {
    for (const entry of stack) entry.block.content = entry.type === "divider" ? [] : fromInlineMarkdown(entry.text, writer);
  };

  for (const raw of markdown.replace(/\r\n?/g, "\n").split("\n")) {
    const line = parseLine(raw);
    if (!line) {
      continuing = false;
      continue;
    }
    const top = stack.at(-1);
    // A plain line right after a paragraph or quote line at the same depth continues it.
    if (
      continuing &&
      top &&
      top.depth === line.depth &&
      (line.type === "paragraph" || line.type === top.type) &&
      (top.type === "paragraph" || top.type === "quote")
    ) {
      top.text += `\n${line.text}`;
      continue;
    }
    while (stack.length > 0 && stack.at(-1)!.depth >= line.depth) {
      const done = stack.pop()!;
      done.block.content = done.type === "divider" ? [] : fromInlineMarkdown(done.text, writer);
    }
    const block: MarkdownBlock = { id: writer.newId(), type: line.type, props: line.props };
    const parent = stack.at(-1);
    if (parent && parent.type !== "divider") (parent.block.children ??= []).push(block);
    else roots.push(block);
    stack.push({ depth: line.depth, block, type: line.type, text: line.text });
    continuing = true;
  }
  finish();
  return roots;
}
