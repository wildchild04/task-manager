import { MENTION_TEXT, type Mark, type RichText, type SimpleMark, type TextSpan } from "~/domain/blocks/types";

/**
 * Rich-text editing at plain-text offsets. Spans are flat, so an offset into
 * the joined text identifies a position exactly. Every function returns new,
 * normalized rich text: no empty spans, and no neighbours with equal marks.
 */

const isLink = (mark: Mark): mark is { type: "link"; href: string } => typeof mark === "object";

const markKey = (mark: Mark) => (isLink(mark) ? `link:${mark.href}` : mark);

function sameMarks(a: readonly Mark[] | undefined, b: readonly Mark[] | undefined): boolean {
  const left = (a ?? []).map(markKey).sort();
  const right = (b ?? []).map(markKey).sort();
  return left.length === right.length && left.every((key, i) => key === right[i]);
}

const span = (text: string, marks: readonly Mark[] | undefined, mention?: TextSpan["mention"]): TextSpan => ({
  text,
  ...(marks && marks.length > 0 ? { marks: [...marks] } : {}),
  ...(mention ? { mention } : {}),
});

export function plain(text: RichText): string {
  return text.map((s) => s.text).join("");
}

export function length(text: RichText): number {
  return plain(text).length;
}

/** Drops empty spans and merges neighbours with the same marks. */
export function normalize(text: RichText): RichText {
  const out: TextSpan[] = [];
  for (const s of text) {
    if (s.text.length === 0) continue;
    const last = out.at(-1);
    // A mention is one unit: it never merges with its neighbours.
    if (last && !last.mention && !s.mention && sameMarks(last.marks, s.marks)) out[out.length - 1] = span(last.text + s.text, last.marks);
    else out.push(span(s.text, s.marks, s.mention));
  }
  return out;
}

/** The text between two offsets, with its marks. */
export function slice(text: RichText, start: number, end = Infinity): RichText {
  const out: TextSpan[] = [];
  let position = 0;
  for (const s of text) {
    const from = Math.max(start, position);
    const to = Math.min(end, position + s.text.length);
    if (from < to) out.push(span(s.text.slice(from - position, to - position), s.marks, s.mention));
    position += s.text.length;
  }
  return normalize(out);
}

export function concat(...parts: RichText[]): RichText {
  return normalize(parts.flat());
}

/** The marks of the character at `offset`, if there is one. */
function marksOfChar(text: RichText, offset: number): readonly Mark[] | undefined {
  let position = 0;
  for (const s of text) {
    if (offset < position + s.text.length) return s.marks;
    position += s.text.length;
  }
  return undefined;
}

/**
 * The marks text typed at `offset` gets: those of the character before it, or
 * of the first character at the start. A link doesn't extend past its end.
 */
export function marksAt(text: RichText, offset: number): Mark[] {
  if (offset === 0) return (marksOfChar(text, 0) ?? []).filter((m) => !isLink(m));
  const before = marksOfChar(text, offset - 1) ?? [];
  const after = marksOfChar(text, offset) ?? [];
  return before.filter((m) => !isLink(m) || after.some((a) => isLink(a) && a.href === m.href));
}

/** Inserts a mention of a page, followed by a space, in place of the text between `start` and `end`. */
export function insertMention(text: RichText, start: number, end: number, pageId: string): RichText {
  return concat(slice(text, 0, start), [{ text: MENTION_TEXT, mention: { pageId } }, { text: " " }], slice(text, end));
}

/** Replaces the text between `start` and `end` with `inserted`, which takes the marks of the replaced text or the caret. */
export function replace(text: RichText, start: number, end: number, inserted: string): RichText {
  const marks = start < end ? (marksOfChar(text, start) ?? []) : marksAt(text, start);
  return concat(slice(text, 0, start), [span(inserted, marks)], slice(text, end));
}

export function insert(text: RichText, offset: number, inserted: string): RichText {
  return replace(text, offset, offset, inserted);
}

export function remove(text: RichText, start: number, end: number): RichText {
  return concat(slice(text, 0, start), slice(text, end));
}

/** Maps the marks of every character between two offsets. */
function mapMarks(text: RichText, start: number, end: number, change: (marks: readonly Mark[]) => Mark[]): RichText {
  return concat(
    slice(text, 0, start),
    slice(text, start, end).map((s) => span(s.text, change(s.marks ?? []), s.mention)),
    slice(text, end),
  );
}

export function hasMark(text: RichText, start: number, end: number, mark: SimpleMark): boolean {
  const range = slice(text, start, end);
  return range.length > 0 && range.every((s) => (s.marks ?? []).includes(mark));
}

/** Adds a mark to the range, or removes it if the whole range already has it. */
export function toggleMark(text: RichText, start: number, end: number, mark: SimpleMark): RichText {
  if (start >= end) return text;
  const present = hasMark(text, start, end, mark);
  return mapMarks(text, start, end, (marks) =>
    present ? marks.filter((m) => m !== mark) : [...marks.filter((m) => m !== mark), mark],
  );
}

/** The link covering the whole range, if any. */
export function linkAt(text: RichText, start: number, end: number): string | undefined {
  const range = slice(text, start, end);
  const first = range[0]?.marks?.find(isLink);
  if (!first) return undefined;
  return range.every((s) => (s.marks ?? []).some((m) => isLink(m) && m.href === first.href)) ? first.href : undefined;
}

/** Sets (or with `null`, removes) the link on a range, replacing any link there. */
export function setLink(text: RichText, start: number, end: number, href: string | null): RichText {
  if (start >= end) return text;
  // Mentions are links already, so they never get a link mark.
  return concat(
    slice(text, 0, start),
    slice(text, start, end).map((s) =>
      span(s.text, [...(s.marks ?? []).filter((m) => !isLink(m)), ...(href && !s.mention ? [{ type: "link" as const, href }] : [])], s.mention),
    ),
    slice(text, end),
  );
}

const graphemes = new Intl.Segmenter(undefined, { granularity: "grapheme" });
const words = new Intl.Segmenter(undefined, { granularity: "word" });

/** The offset one character (grapheme) before `offset`. */
export function previousCharacter(value: string, offset: number): number {
  let last = 0;
  for (const { index } of graphemes.segment(value)) {
    if (index >= offset) break;
    last = index;
  }
  return last;
}

/** The offset one character (grapheme) after `offset`. */
export function nextCharacter(value: string, offset: number): number {
  for (const { index, segment } of graphemes.segment(value)) {
    if (index + segment.length > offset) return index + segment.length;
  }
  return value.length;
}

/** The start of the word before `offset`, skipping spaces first. */
export function previousWord(value: string, offset: number): number {
  let start = 0;
  for (const { index, isWordLike } of words.segment(value)) {
    if (index >= offset) break;
    if (isWordLike) start = index;
  }
  return start;
}

/** The end of the word after `offset`, skipping spaces first. */
export function nextWord(value: string, offset: number): number {
  for (const { index, segment, isWordLike } of words.segment(value)) {
    if (isWordLike && index + segment.length > offset) return index + segment.length;
  }
  return value.length;
}

/**
 * The whole link around a caret at `offset` (touching it from either side):
 * its range and URL, or `undefined` when the caret isn't on a link.
 */
export function linkRangeAt(text: RichText, offset: number): { start: number; end: number; href: string } | undefined {
  const hrefAt = (index: number) => {
    const marks = marksOfChar(text, index);
    return marks?.find(isLink)?.href;
  };
  const href = hrefAt(offset) ?? (offset > 0 ? hrefAt(offset - 1) : undefined);
  if (!href) return undefined;
  let start = hrefAt(offset) === href ? offset : offset - 1;
  while (start > 0 && hrefAt(start - 1) === href) start--;
  let end = start;
  while (hrefAt(end) === href) end++;
  return { start, end, href };
}
