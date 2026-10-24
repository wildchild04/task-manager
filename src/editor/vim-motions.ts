import { caretOrder, type EditorState, getBlock, type Point } from "./editor-state";
import { nextCharacter, plain, previousCharacter } from "./rich-text";

/**
 * Vim's motions over the editor's text that don't depend on layout: by
 * character and by word. Offsets are plain-text offsets, as everywhere in the
 * editor. Lines (`0 ^ $ j k gg G`) need the layout and live in `vim.ts`.
 */

/** Blank, keyword (letters, digits, `_`) or other: a word is a run of one class, other than blanks. */
function classOf(char: string | undefined): 0 | 1 | 2 {
  if (char === undefined || /\s/u.test(char)) return 0;
  return /[\p{L}\p{N}_]/u.test(char) ? 1 : 2;
}

const valueOf = (state: EditorState, id: string) => plain(getBlock(state, id).content);

/** The last offset the Normal-mode cursor can rest on: the block's last character (0 when empty). */
export function lastCharacter(value: string): number {
  return value.length === 0 ? 0 : previousCharacter(value, value.length);
}

/** `l`: a character right, never past the last one. */
export function right(value: string, offset: number): number {
  const next = nextCharacter(value, offset);
  return next >= value.length ? lastCharacter(value) : next;
}

/** `h`: a character left, never before the block's start. */
export const left = (value: string, offset: number): number => previousCharacter(value, offset);

/** The first non-blank character at or after `from` before `to` (or `to` when the line is blank). */
export function firstNonBlank(value: string, from: number, to = value.length): number {
  let at = from;
  while (at < to && /[ \t]/.test(value[at]!)) at++;
  return at;
}

/** The next word's start after `offset` in the same text, or `value.length` when there is none. */
export function nextWordStart(value: string, offset: number): number {
  let at = offset;
  const kind = classOf(value[at]);
  if (kind !== 0) while (at < value.length && classOf(value[at]) === kind) at++;
  while (at < value.length && classOf(value[at]) === 0) at++;
  return at;
}

/** The start of the word before `offset` in the same text, or `null` when there is none. */
export function previousWordStart(value: string, offset: number): number | null {
  let at = offset - 1;
  while (at >= 0 && classOf(value[at]) === 0) at--;
  if (at < 0) return null;
  const kind = classOf(value[at]);
  while (at > 0 && classOf(value[at - 1]) === kind) at--;
  return at;
}

/** The end (last character) of the word after `offset` in the same text, or `null` when there is none. */
export function wordEnd(value: string, offset: number): number | null {
  let at = offset + 1;
  while (at < value.length && classOf(value[at]) === 0) at++;
  if (at >= value.length) return null;
  const kind = classOf(value[at]);
  while (at + 1 < value.length && classOf(value[at + 1]) === kind) at++;
  return at;
}

/** The end of the word under `offset` (`cw` changes up to it); on blanks, the end of the blanks. */
export function endOfCurrentWord(value: string, offset: number): number {
  const kind = classOf(value[offset]);
  let at = offset;
  while (at + 1 < value.length && classOf(value[at + 1]) === kind) at++;
  return at;
}

/** The text blocks the cursor moves through, in reading order, without the title. */
function textBlocks(state: EditorState, closed?: ReadonlySet<string>): string[] {
  return caretOrder(state, closed).filter((id) => id !== state.rootId);
}

/** `w`: the next word's start, going on into the following text blocks (an empty block is a stop, as an empty line is in Vim). */
export function wordForward(state: EditorState, from: Point, closed?: ReadonlySet<string>): Point {
  const value = valueOf(state, from.blockId);
  const at = nextWordStart(value, from.offset);
  if (at < value.length) return { blockId: from.blockId, offset: at };
  const order = textBlocks(state, closed);
  for (const id of order.slice(order.indexOf(from.blockId) + 1)) {
    const next = valueOf(state, id);
    const start = firstNonBlank(next, 0);
    if (next.length === 0 || start < next.length) return { blockId: id, offset: start };
  }
  return { blockId: from.blockId, offset: lastCharacter(value) };
}

/** `b`: the previous word's start, going back into the preceding text blocks. */
export function wordBackward(state: EditorState, from: Point, closed?: ReadonlySet<string>): Point {
  const at = previousWordStart(valueOf(state, from.blockId), from.offset);
  if (at !== null) return { blockId: from.blockId, offset: at };
  const order = textBlocks(state, closed);
  for (const id of order.slice(0, Math.max(0, order.indexOf(from.blockId))).reverse()) {
    const value = valueOf(state, id);
    if (value.length === 0) return { blockId: id, offset: 0 };
    const start = previousWordStart(value, value.length);
    if (start !== null) return { blockId: id, offset: start };
  }
  return { blockId: from.blockId, offset: 0 };
}

/** `e`: the next word's end, going on into the following text blocks (empty ones are skipped, as in Vim). */
export function wordEndForward(state: EditorState, from: Point, closed?: ReadonlySet<string>): Point {
  const value = valueOf(state, from.blockId);
  const at = wordEnd(value, from.offset);
  if (at !== null) return { blockId: from.blockId, offset: at };
  const order = textBlocks(state, closed);
  for (const id of order.slice(order.indexOf(from.blockId) + 1)) {
    const end = wordEnd(valueOf(state, id), -1);
    if (end !== null) return { blockId: id, offset: end };
  }
  return { blockId: from.blockId, offset: lastCharacter(value) };
}
