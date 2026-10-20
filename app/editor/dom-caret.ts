import { type Mark, MENTION_TEXT, type RichText } from "~/domain/blocks/types";
import type { Point, Selection, TextRange } from "~/editor/editor-state";

import type { MentionTarget, MentionTargets } from "../blocks/view-model";
import { withBase } from "../lib/base-path";

/**
 * The DOM side of the editor: drawing rich text into an editable element and
 * mapping DOM positions to plain-text offsets and back. Editable elements carry
 * `data-block-id`; their text uses `white-space: pre-wrap`, so `\n` is a line
 * break and offsets match text node characters one to one.
 */

const MARK_TAGS: Record<Exclude<Mark, object>, string> = {
  bold: "strong",
  italic: "em",
  underline: "u",
  strikethrough: "s",
  code: "code",
};

/**
 * Replaces an editable element's content with the rich text. React never
 * renders inside it. The ends of the selection inside the element (one or
 * both, when it spans blocks) are kept at the same offsets.
 */
export function renderRichText(element: HTMLElement, content: RichText, mentions: MentionTargets = {}): void {
  const kept = keptEnds(element);
  const nodes: Node[] = content.map((span) => {
    let node: Node = span.mention
      ? mentionElement(span.mention.pageId, mentions[span.mention.pageId])
      : document.createTextNode(span.text);
    for (const mark of span.marks ?? []) {
      const wrapper =
        typeof mark === "object"
          ? Object.assign(document.createElement("a"), { href: withBase(mark.href) })
          : document.createElement(MARK_TAGS[mark]);
      wrapper.appendChild(node);
      node = wrapper;
    }
    return node;
  });
  // An empty block, or a trailing line break, needs a <br> to have a line to put the caret on.
  const text = content.map((s) => s.text).join("");
  if (text === "" || text.endsWith("\n")) nodes.push(Object.assign(document.createElement("br"), { className: "editor-filler" }));
  element.replaceChildren(...nodes);
  element.dataset.empty = String(text === "");
  kept?.();
}

/**
 * Notes where the DOM selection's ends inside `element` are, as text offsets;
 * returns a function putting them back after its content is replaced (an end
 * elsewhere stays where it is), or `null` when neither end is inside.
 */
function keptEnds(element: HTMLElement): (() => void) | null {
  const selection = window.getSelection();
  if (!selection || selection.rangeCount === 0 || !selection.anchorNode || !selection.focusNode) return null;
  const { anchorNode, anchorOffset, focusNode, focusOffset } = selection;
  type End = { node: Node; offset: number; inside: number | null };
  const ends: End[] = [
    { node: anchorNode, offset: anchorOffset, inside: null },
    { node: focusNode, offset: focusOffset, inside: null },
  ].map((end) => ({ ...end, inside: element.contains(end.node) ? offsetOf(element, end.node, end.offset) : null }));
  if (ends.every((end) => end.inside === null)) return null;
  return () => {
    const [anchor, focus] = ends.map((end) => (end.inside === null ? end : positionOf(element, end.inside)));
    selection.setBaseAndExtent(anchor!.node, anchor!.offset, focus!.node, focus!.offset);
  };
}

function setSelectionIn(element: HTMLElement, anchorOffset: number, focusOffset: number) {
  const anchor = positionOf(element, anchorOffset);
  const focus = positionOf(element, focusOffset);
  window.getSelection()?.setBaseAndExtent(anchor.node, anchor.offset, focus.node, focus.offset);
}

/**
 * A mention: a non-editable link whose only text is the placeholder character
 * (hidden), so caret offsets count it as one character; CSS draws the title.
 */
function mentionElement(pageId: string, target: MentionTarget | null | undefined): HTMLElement {
  const element = document.createElement(target ? "a" : "span");
  element.className = target ? "mention" : "mention mention-missing";
  element.contentEditable = "false";
  element.dataset.mentionPageId = pageId;
  element.dataset.title = target?.title ?? "Missing page";
  if (target) element.setAttribute("href", withBase(target.href));
  const placeholder = document.createElement("span");
  placeholder.className = "mention-placeholder";
  placeholder.textContent = MENTION_TEXT;
  element.appendChild(placeholder);
  return element;
}

/** The editable element of a block. */
export function editableOf(root: ParentNode, blockId: string): HTMLElement | null {
  return root.querySelector<HTMLElement>(`[data-block-id="${CSS.escape(blockId)}"]`);
}

/** The plain text of an editable element, as the editor counts it. */
export function textOf(element: HTMLElement): string {
  let text = "";
  const walker = document.createTreeWalker(element, NodeFilter.SHOW_TEXT);
  for (let node = walker.nextNode(); node; node = walker.nextNode()) text += node.nodeValue ?? "";
  return text;
}

/** The text offset of a DOM position inside an editable element. */
export function offsetOf(element: HTMLElement, node: Node, offset: number): number {
  const range = document.createRange();
  range.selectNodeContents(element);
  range.setEnd(node, offset);
  // Count only text nodes, so the filler <br> adds nothing.
  const fragment = range.cloneContents();
  let length = 0;
  const walker = document.createTreeWalker(fragment, NodeFilter.SHOW_TEXT);
  for (let text = walker.nextNode(); text; text = walker.nextNode()) length += text.nodeValue?.length ?? 0;
  return length;
}

const blockElementOf = (node: Node | null): HTMLElement | null =>
  (node instanceof HTMLElement ? node : node?.parentElement)?.closest<HTMLElement>("[data-block-id]") ?? null;

/** The editor selection matching the DOM selection, when it lies inside one editable block. */
export function readSelection(): Selection | null {
  const selection = window.getSelection();
  if (!selection || selection.rangeCount === 0 || !selection.anchorNode || !selection.focusNode) return null;
  const element = blockElementOf(selection.anchorNode);
  if (!element || element !== blockElementOf(selection.focusNode)) return null;
  return {
    blockId: element.dataset.blockId!,
    anchor: offsetOf(element, selection.anchorNode, selection.anchorOffset),
    focus: offsetOf(element, selection.focusNode, selection.focusOffset),
  };
}

/**
 * The text selected across editable blocks, when the DOM selection's ends are
 * in two different blocks. `rootId` (the title) never takes part.
 */
export function readRange(rootId: string): TextRange | null {
  const selection = window.getSelection();
  if (!selection || selection.rangeCount === 0 || !selection.anchorNode || !selection.focusNode) return null;
  const anchor = blockElementOf(selection.anchorNode);
  const focus = blockElementOf(selection.focusNode);
  if (!anchor || !focus || anchor === focus || anchor.dataset.blockId === rootId || focus.dataset.blockId === rootId) return null;
  if (!anchor.isContentEditable || !focus.isContentEditable) return null;
  return {
    anchor: { blockId: anchor.dataset.blockId!, offset: offsetOf(anchor, selection.anchorNode, selection.anchorOffset) },
    focus: { blockId: focus.dataset.blockId!, offset: offsetOf(focus, selection.focusNode, selection.focusOffset) },
  };
}

/**
 * Selects text across blocks. Browsers keep a selection the user makes inside
 * the editable element it starts in, but one set from script may cross them;
 * focus stays in the anchor's block, so keys arrive there.
 */
export function writeRange(root: ParentNode, range: TextRange): void {
  const anchor = editableOf(root, range.anchor.blockId);
  const focus = editableOf(root, range.focus.blockId);
  if (!anchor || !focus) return;
  if (document.activeElement !== anchor) anchor.focus({ preventScroll: true });
  const from = positionOf(anchor, range.anchor.offset);
  const to = positionOf(focus, range.focus.offset);
  window.getSelection()?.setBaseAndExtent(from.node, from.offset, to.node, to.offset);
}

type CaretDocument = Document & {
  caretPositionFromPoint?: (x: number, y: number) => { offsetNode: Node; offset: number } | null;
  caretRangeFromPoint?: (x: number, y: number) => Range | null;
};

/** The DOM position under a point of the window, if the browser can tell. */
function positionAtPoint(x: number, y: number): { node: Node; offset: number } | null {
  const doc = document as CaretDocument;
  const position = doc.caretPositionFromPoint?.(x, y);
  if (position) return { node: position.offsetNode, offset: position.offset };
  const range = doc.caretRangeFromPoint?.(x, y);
  return range ? { node: range.startContainer, offset: range.startOffset } : null;
}

/** The text position under a point of the window, when it's in an editable block inside `root`. */
export function pointAt(root: HTMLElement, x: number, y: number): Point | null {
  const position = positionAtPoint(x, y);
  const element = position && blockElementOf(position.node);
  if (!position || !element || !root.contains(element) || !element.isContentEditable) return null;
  return { blockId: element.dataset.blockId!, offset: offsetOf(element, position.node, position.offset) };
}

/** The DOM position of a text offset inside an editable element. */
function positionOf(element: HTMLElement, offset: number): { node: Node; offset: number } {
  const walker = document.createTreeWalker(element, NodeFilter.SHOW_TEXT);
  let remaining = offset;
  let last: Text | null = null;
  for (let node = walker.nextNode() as Text | null; node; node = walker.nextNode() as Text | null) {
    const length = node.nodeValue?.length ?? 0;
    if (remaining <= length) {
      // Never inside a mention: just before it, or just after.
      const mention = node.parentElement?.closest<HTMLElement>("[data-mention-page-id]");
      if (mention?.parentNode) {
        const index = Array.prototype.indexOf.call(mention.parentNode.childNodes, mention) as number;
        return { node: mention.parentNode, offset: index + (remaining > 0 ? 1 : 0) };
      }
      return { node, offset: remaining };
    }
    remaining -= length;
    last = node;
  }
  return last ? { node: last, offset: last.nodeValue?.length ?? 0 } : { node: element, offset: 0 };
}

/** Puts the DOM selection (and focus) where the editor selection is. */
export function writeSelection(root: ParentNode, selection: Selection): void {
  const element = editableOf(root, selection.blockId);
  if (!element) return;
  if (document.activeElement !== element) element.focus({ preventScroll: true });
  setSelectionIn(element, selection.anchor, selection.focus);
  element.scrollIntoView?.({ block: "nearest" });
}

/** The client rectangle of the caret, or `null` when the browser can't tell (empty lines). */
export function caretRect(): DOMRect | null {
  const selection = window.getSelection();
  if (!selection || selection.rangeCount === 0) return null;
  const range = selection.getRangeAt(0).cloneRange();
  range.collapse(false);
  const rect = range.getClientRects()[0];
  return rect && rect.height > 0 ? rect : null;
}

/** The rectangles of an element's first and last lines of text. */
function lineRects(element: HTMLElement): { first: DOMRect; last: DOMRect } | null {
  const range = document.createRange();
  range.selectNodeContents(element);
  const rects = [...range.getClientRects()].filter((r) => r.height > 0);
  if (rects.length === 0) return null;
  return { first: rects[0]!, last: rects.at(-1)! };
}

/** Whether the caret is on the first (or last) visual line of its block. */
export function caretOnEdgeLine(element: HTMLElement, edge: "first" | "last"): boolean {
  return onEdgeLine(element, caretRect(), edge);
}

/** The client rectangle of a text offset in an editable element, or `null` when the browser can't tell (empty lines). */
export function rectAt(element: HTMLElement, offset: number): DOMRect | null {
  const position = positionOf(element, offset);
  const range = document.createRange();
  range.setStart(position.node, position.offset);
  range.collapse(true);
  const rect = range.getClientRects()[0];
  return rect && rect.height > 0 ? rect : null;
}

/** Whether a text offset is on the first (or last) visual line of its block. */
export function offsetOnEdgeLine(element: HTMLElement, offset: number, edge: "first" | "last"): boolean {
  return onEdgeLine(element, rectAt(element, offset), edge);
}

function onEdgeLine(element: HTMLElement, caret: DOMRect | null, edge: "first" | "last"): boolean {
  const lines = lineRects(element);
  if (!caret || !lines) return true;
  const line = edge === "first" ? lines.first : lines.last;
  const middle = caret.top + caret.height / 2;
  return middle >= line.top - 1 && middle <= line.bottom + 1;
}

/** The text offset in an element closest to horizontal position `x` on its first or last line. */
export function offsetAtX(element: HTMLElement, x: number, edge: "first" | "last"): number {
  const lines = lineRects(element);
  if (!lines) return 0;
  const line = edge === "first" ? lines.first : lines.last;
  const y = line.top + line.height / 2;
  const position = positionAtPoint(x, y);
  if (!position || !element.contains(position.node)) return edge === "first" ? 0 : textOf(element).length;
  return offsetOf(element, position.node, position.offset);
}
