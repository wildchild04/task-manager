import type { RichText, TreeNode } from "~/domain/blocks/types";

import { blockTrees, selectedTrees } from "./clipboard";
import type { Editor } from "./editor";
import { caret, documentOrder, getBlock, type Point, selectableOf, selectableOrder } from "./editor-state";
import { nextCharacter, plain, previousCharacter, slice } from "./rich-text";
import * as across from "./selection";
import { deleteText, insertContent, openLine, pasteTrees } from "./vim-commands";
import * as motions from "./vim-motions";

export type VimMode = "normal" | "insert" | "visual";

/** An image the cursor stops at (selected whole), as ↓/↑ do. */
export type ImageStop = { image: string };

/**
 * What Vim mode needs from the page's layout: the visual lines of a block and
 * moving a line down or up. The page editor implements it with the DOM; tests
 * with a fake where each block is one line (code: one per text line).
 */
export interface VimLayout {
  /** Where the line holding `point` starts, and where it ends (after its last character, before a line break). */
  line(point: Point): { start: number; end: number };
  /**
   * `j`/`k`: the stop a line below (1) or above (-1), as ↓/↑ go: within the
   * block, then on to the next text block (by column in tables) or image.
   * `null` at the page's edges. Keeps the column across calls until `forgetColumn`.
   */
  vertical(from: Point | ImageStop, step: -1 | 1): Point | ImageStop | null;
  forgetColumn(): void;
}

export type VimOptions = {
  /** The clock for the leader key's timeout. */
  now?: () => number;
  onMode?: (mode: VimMode) => void;
  /** Writes the Visual selection to the system clipboard (`y`), while it's still selected. */
  copy?: () => void;
  /** Opens the slash (`/`) or mention (`@`) menu for the trigger just typed at `start` in a block. */
  openMenu?: (blockId: string, start: number) => void;
  /** Shows the list of Vim mode's keys (`?`). */
  help?: () => void;
  newId?: () => string;
};

/** How long the leader (Space) waits for the key after it. */
export const LEADER_TIMEOUT_MS = 1000;

type Operator = "d" | "c" | "y";
type Register = { kind: "text"; content: RichText } | { kind: "blocks"; trees: TreeNode[] };

/** Arrow keys move like `h j k l` in Normal and Visual mode. */
const ARROWS: Record<string, string> = { ArrowLeft: "h", ArrowDown: "j", ArrowUp: "k", ArrowRight: "l" };
const MOTIONS = new Set(["h", "l", "w", "b", "e", "0", "^", "$", "j", "k", "G"]);

const isImage = (stop: Point | ImageStop): stop is ImageStop => "image" in stop;

/**
 * Vim mode over an editor: the mode, a pending count, operator, `g` and
 * leader, and one unnamed register. `key()` takes each key the page editor
 * routes to it and makes the edits with the editor's commands, so every
 * operator is one undo step and is saved like any other edit. No DOM.
 */
export class Vim {
  mode: VimMode = "normal";
  /** What `y`, `d`, `x` and `c` last took. */
  register: Register | null = null;
  private count = "";
  private operator: { name: Operator; count: number } | null = null;
  private pendingG = false;
  private leaderAt: number | null = null;
  /** In Visual mode: where the selection started, and the cursor (both on characters). */
  private visual: { anchor: Point; cursor: Point } | null = null;
  private readonly now: () => number;

  constructor(
    private readonly editor: Editor,
    private readonly layout: VimLayout,
    private readonly options: VimOptions = {},
  ) {
    this.now = options.now ?? (() => Date.now());
  }

  /**
   * Handles a key. In Insert mode only `Escape` is Vim's; in Normal and
   * Visual every key is (Ctrl only with `r`). Returns whether the key was
   * taken: the caller then prevents its default and puts the DOM selection
   * where the editor's is.
   */
  key(key: string, ctrl = false): boolean {
    if (this.mode === "insert") {
      if (key !== "Escape") return false;
      this.leaveInsert();
      return true;
    }
    if (ctrl) {
      if (key !== "r") return false;
      this.clearPending();
      for (let i = 0; i < this.takeCount(); i++) this.editor.redo();
      this.rest();
      return true;
    }
    if (this.leaderAt !== null) {
      const fresh = this.now() - this.leaderAt <= LEADER_TIMEOUT_MS;
      this.leaderAt = null;
      if (fresh) this.leader(key);
      return true;
    }
    const k = ARROWS[key] ?? key;
    if (k === "Escape") {
      this.clearPending();
      if (this.mode === "visual") this.leaveVisual();
      return true;
    }
    if (/^[1-9]$/.test(k) || (k === "0" && this.count !== "")) {
      this.count += k;
      return true;
    }
    if (this.mode === "visual") this.visualKey(k);
    else this.normalKey(k);
    return true;
  }

  /** Leaves Insert or Visual for Normal (a click while in Visual), with the cursor where the caret is. */
  toNormal(): void {
    this.clearPending();
    this.visual = null;
    this.setMode("normal");
    this.rest();
  }

  /** `j`/`k` (or ↓/↑) while an image is selected: on to the next stop. */
  fromImage(image: string, step: -1 | 1): void {
    const stop = this.layout.vertical({ image }, step);
    if (stop && !(!isImage(stop) && stop.blockId === this.editor.state.rootId)) this.arrive(stop);
  }

  // ----- Normal mode -----

  private normalKey(k: string): void {
    const count = this.takeCount();
    if (this.pendingG) {
      this.pendingG = false;
      if (k === "g") this.moveTo({ blockId: this.cursor().blockId, offset: 0 });
      return;
    }
    if (this.operator) {
      const operator = this.operator;
      this.operator = null;
      this.operate(operator.name, k, operator.count * count);
      return;
    }
    if (MOTIONS.has(k)) {
      if (k !== "j" && k !== "k") this.layout.forgetColumn();
      const stop = this.motion(k, this.cursor(), count);
      if (stop) this.arrive(stop);
      return;
    }
    const at = this.cursor();
    const value = this.valueOf(at.blockId);
    switch (k) {
      case "g":
        this.pendingG = true;
        return;
      case "d":
      case "c":
      case "y":
        this.operator = { name: k, count };
        return;
      case "i":
        return this.insertAt(at);
      case "a":
        return this.insertAt({ blockId: at.blockId, offset: value.length === 0 ? 0 : nextCharacter(value, at.offset) });
      case "I": {
        const line = this.layout.line(at);
        return this.insertAt({ blockId: at.blockId, offset: motions.firstNonBlank(value, line.start, line.end) });
      }
      case "A":
        return this.insertAt({ blockId: at.blockId, offset: value.length });
      case "o":
      case "O": {
        const result = openLine(this.editor.state, at.blockId, k === "o" ? "after" : "before", this.context, this.layout.line(at));
        if (!this.editor.runCommand(result)) return;
        this.layout.forgetColumn();
        this.setMode("insert");
        return;
      }
      case "x": {
        let to = at.offset;
        for (let i = 0; i < count; i++) to = nextCharacter(value, to);
        this.deleteRange(at.blockId, at.offset, to);
        return;
      }
      case "p":
      case "P":
        return this.put(k === "p" ? "after" : "before", count);
      case "u":
        for (let i = 0; i < count; i++) this.editor.undo();
        this.rest();
        return;
      case "v":
        this.visual = { anchor: at, cursor: at };
        this.setMode("visual");
        this.showVisual();
        return;
      case " ":
        this.leaderAt = this.now();
        return;
      case "?":
        this.options.help?.();
        return;
      default:
      // Keys without a meaning in Normal mode do nothing; above all, they never type.
    }
  }

  /** An operator followed by `k`: the same key again (`dd`, `cc`, `yy`) or a motion within the block. */
  private operate(name: Operator, k: string, count: number): void {
    const at = this.cursor();
    const block = getBlock(this.editor.state, at.blockId);
    const value = plain(block.content);
    if (k === name) {
      if (name === "c") {
        this.yankText(at.blockId, 0, value.length);
        this.editor.runCommand(deleteText(this.editor.state, at.blockId, 0, value.length));
        return this.insertAt({ blockId: at.blockId, offset: 0 });
      }
      const order = selectableOrder(this.editor.state, this.editor.closed);
      const first = order.indexOf(selectableOf(this.editor.state, at.blockId));
      if (first < 0) return;
      const roots = order.slice(first, first + count);
      this.register = { kind: "blocks", trees: blockTrees(this.editor.state, roots) };
      if (name === "y") return;
      const result = across.deleteBlocks(this.editor.state, roots, this.context.newId, this.editor.closed, "after");
      if (!result) return;
      // Sub-pages and suggestions stay where they were; Vim keeps no block selection.
      this.editor.runCommand({ ...result, blocks: undefined });
      const { blockId } = this.editor.selection;
      this.moveTo({ blockId, offset: motions.firstNonBlank(this.valueOf(blockId), 0) });
      return;
    }
    const range = this.textRange(k, value, at, count, name === "c");
    if (!range) return;
    if (name === "y") {
      this.yankText(at.blockId, range.from, range.to);
      this.moveTo({ blockId: at.blockId, offset: range.from });
      return;
    }
    this.deleteRange(at.blockId, range.from, range.to, name === "c");
  }

  /** The text an operator's motion covers, within the cursor's block. */
  private textRange(k: string, value: string, at: Point, count: number, change: boolean): { from: number; to: number } | null {
    let to = at.offset;
    switch (k) {
      case "w":
        // `cw` changes to the word's end, keeping the space after it.
        if (change && value.length > 0) {
          to = motions.endOfCurrentWord(value, at.offset);
          for (let i = 1; i < count; i++) to = motions.wordEnd(value, to) ?? value.length - 1;
          return { from: at.offset, to: to + 1 };
        }
        for (let i = 0; i < count; i++) to = motions.nextWordStart(value, to);
        return { from: at.offset, to };
      case "e":
        for (let i = 0; i < count; i++) to = motions.wordEnd(value, to) ?? value.length - 1;
        return { from: at.offset, to: Math.min(value.length, to + 1) };
      case "b": {
        let from = at.offset;
        for (let i = 0; i < count; i++) from = motions.previousWordStart(value, from) ?? 0;
        return { from, to: at.offset };
      }
      case "l":
        for (let i = 0; i < count; i++) to = nextCharacter(value, to);
        return { from: at.offset, to };
      case "h": {
        let from = at.offset;
        for (let i = 0; i < count; i++) from = previousCharacter(value, from);
        return { from, to: at.offset };
      }
      case "$":
        return { from: at.offset, to: this.layout.line(at).end };
      case "0":
        return { from: this.layout.line(at).start, to: at.offset };
      case "^": {
        const line = this.layout.line(at);
        const start = motions.firstNonBlank(value, line.start, line.end);
        return start < at.offset ? { from: start, to: at.offset } : { from: at.offset, to: start };
      }
      default:
        return null;
    }
  }

  /** `p`/`P`: the register's text after or at the cursor, or its blocks after or before the cursor's block. */
  private put(side: "after" | "before", count: number): void {
    const register = this.register;
    if (!register) return;
    const at = this.cursor();
    if (register.kind === "text") {
      const value = this.valueOf(at.blockId);
      const offset = side === "after" && value.length > 0 ? nextCharacter(value, at.offset) : at.offset;
      const content = Array.from({ length: count }, () => register.content).flat();
      if (!this.editor.runCommand(insertContent(this.editor.state, at.blockId, offset, content))) return;
      const end = this.editor.selection.focus;
      this.moveTo({ blockId: at.blockId, offset: previousCharacter(this.valueOf(at.blockId), end) });
      return;
    }
    const trees = Array.from({ length: count }, () => register.trees).flat();
    const id = selectableOf(this.editor.state, at.blockId);
    const result = pasteTrees(this.editor.state, id, side, trees, this.context.newId, this.editor.selection);
    if (!this.editor.runCommand(result)) return;
    const { blockId } = this.editor.selection;
    this.moveTo({ blockId, offset: motions.firstNonBlank(this.valueOf(blockId), 0) });
  }

  // ----- Visual mode -----

  private visualKey(k: string): void {
    const visual = this.visual!;
    const count = this.takeCount();
    if (this.pendingG) {
      this.pendingG = false;
      if (k === "g") this.extendTo({ blockId: visual.cursor.blockId, offset: 0 });
      return;
    }
    if (MOTIONS.has(k)) {
      if (k !== "j" && k !== "k") this.layout.forgetColumn();
      let stop = this.motion(k, visual.cursor, count);
      // Visual selects text: images are passed over.
      while (stop && isImage(stop)) stop = this.layout.vertical(stop, k === "k" ? -1 : 1);
      if (stop && stop.blockId !== this.editor.state.rootId) this.extendTo(stop);
      return;
    }
    switch (k) {
      case "g":
        this.pendingG = true;
        return;
      case "v":
        return this.leaveVisual();
      case "y":
        this.yankVisual();
        this.options.copy?.();
        return this.leaveVisual(this.visualStart());
      case "d":
      case "x":
      case "c": {
        this.yankVisual();
        const start = this.visualStart();
        if (this.editor.range) this.editor.removeSelection();
        else {
          const { blockId, anchor, focus } = this.editor.selection;
          this.editor.runCommand(deleteText(this.editor.state, blockId, Math.min(anchor, focus), Math.max(anchor, focus)));
        }
        this.visual = null;
        if (k === "c") return this.insertAt(start);
        this.setMode("normal");
        this.rest();
        return;
      }
      default:
    }
  }

  private extendTo(point: Point): void {
    this.visual!.cursor = point;
    this.showVisual();
  }

  /** Selects from the anchor's character to the cursor's, both included, in the editor. */
  private showVisual(): void {
    const { anchor, cursor } = this.visual!;
    const after = (point: Point) => ({
      blockId: point.blockId,
      offset: Math.min(this.valueOf(point.blockId).length, nextCharacter(this.valueOf(point.blockId), point.offset)),
    });
    if (anchor.blockId === cursor.blockId) {
      const forward = anchor.offset <= cursor.offset;
      const start = forward ? anchor : cursor;
      const end = after(forward ? cursor : anchor);
      this.editor.setSelection({
        blockId: anchor.blockId,
        anchor: forward ? start.offset : end.offset,
        focus: forward ? end.offset : start.offset,
      });
      return;
    }
    const order = documentOrder(this.editor.state);
    const forward = order.indexOf(anchor.blockId) < order.indexOf(cursor.blockId);
    this.editor.setRange(forward ? { anchor, focus: after(cursor) } : { anchor: after(anchor), focus: cursor });
  }

  /** The start of the Visual selection, in reading order. */
  private visualStart(): Point {
    const { anchor, cursor } = this.visual!;
    if (anchor.blockId === cursor.blockId) return anchor.offset <= cursor.offset ? anchor : cursor;
    const order = documentOrder(this.editor.state);
    return order.indexOf(anchor.blockId) < order.indexOf(cursor.blockId) ? anchor : cursor;
  }

  /** Puts the Visual selection in the register: text within one block, or the blocks it spans. */
  private yankVisual(): void {
    const { range, selection } = this.editor;
    if (range) {
      this.register = { kind: "blocks", trees: selectedTrees(this.editor.state, range.anchor, range.focus) };
      return;
    }
    this.yankText(selection.blockId, Math.min(selection.anchor, selection.focus), Math.max(selection.anchor, selection.focus));
  }

  private leaveVisual(at: Point = this.visual!.cursor): void {
    this.visual = null;
    this.setMode("normal");
    this.moveTo(at);
  }

  // ----- Leader -----

  private leader(key: string): void {
    const at = this.cursor();
    if (key === "Escape") {
      this.editor.selectBlock(at.blockId);
      return;
    }
    if (key !== "/" && key !== "@") return;
    // As if typed after the cursor's character.
    const value = this.valueOf(at.blockId);
    const start = value.length === 0 ? 0 : nextCharacter(value, at.offset);
    this.insertAt({ blockId: at.blockId, offset: start });
    this.editor.type(key);
    this.options.openMenu?.(at.blockId, start);
  }

  // ----- Motions -----

  /** Where a motion goes from `from`, `count` times. */
  private motion(k: string, from: Point, count: number): Point | ImageStop | null {
    const { state, closed } = this.editor;
    const value = this.valueOf(from.blockId);
    const repeat = (step: (point: Point) => Point) => {
      let point = from;
      for (let i = 0; i < count; i++) point = step(point);
      return point;
    };
    switch (k) {
      case "h":
        return repeat((p) => ({ ...p, offset: motions.left(value, p.offset) }));
      case "l":
        return repeat((p) => ({ ...p, offset: motions.right(value, p.offset) }));
      case "w":
        return repeat((p) => motions.wordForward(state, p, closed));
      case "b":
        return repeat((p) => motions.wordBackward(state, p, closed));
      case "e":
        return repeat((p) => motions.wordEndForward(state, p, closed));
      case "0":
        return { ...from, offset: this.layout.line(from).start };
      case "^": {
        const line = this.layout.line(from);
        return { ...from, offset: motions.firstNonBlank(value, line.start, line.end) };
      }
      case "$": {
        const line = this.layout.line(from);
        return { ...from, offset: line.end > line.start ? previousCharacter(value, line.end) : line.start };
      }
      case "G":
        return { ...from, offset: this.layout.line({ ...from, offset: value.length }).start };
      case "j":
      case "k": {
        let stop: Point | ImageStop = from;
        for (let i = 0; i < count; i++) {
          const next = this.layout.vertical(stop, k === "j" ? 1 : -1);
          // The title is out of Vim's reach: `k` stops at the first block.
          if (!next || (!isImage(next) && next.blockId === state.rootId)) break;
          stop = next;
          // An image is a stop: the count ends there.
          if (isImage(stop)) break;
        }
        return stop === from ? null : stop;
      }
      default:
        return null;
    }
  }

  /** Arrives at a stop in Normal mode: selects an image whole, or puts the cursor on a character. */
  private arrive(stop: Point | ImageStop): void {
    if (isImage(stop)) this.editor.selectBlock(stop.image);
    else this.moveTo(stop);
  }

  // ----- Helpers -----

  private get context() {
    return { newId: this.options.newId ?? (() => crypto.randomUUID()), closed: this.editor.closed };
  }

  private valueOf(id: string): string {
    return plain(getBlock(this.editor.state, id).content);
  }

  /** The cursor: the caret, on a character (never after a block's last one). */
  private cursor(): Point {
    const { range, selection } = this.editor;
    const point = range ? range.focus : { blockId: selection.blockId, offset: selection.focus };
    return { blockId: point.blockId, offset: Math.min(point.offset, motions.lastCharacter(this.valueOf(point.blockId))) };
  }

  /** Puts the cursor on a character in Normal mode. */
  private moveTo(point: Point): void {
    const offset = Math.min(point.offset, motions.lastCharacter(this.valueOf(point.blockId)));
    this.editor.setSelection(caret(point.blockId, offset));
  }

  /** After an edit or undo in Normal mode: no selection left, the cursor on a character. */
  private rest(): void {
    if (this.editor.blocks) this.editor.selectBlocks(null);
    this.moveTo(this.cursor());
  }

  private insertAt(point: Point): void {
    this.editor.setSelection(caret(point.blockId, point.offset));
    this.layout.forgetColumn();
    this.setMode("insert");
  }

  /** Esc in Insert: back to Normal, the cursor a character back (not before the line's start). */
  private leaveInsert(): void {
    const { blockId, focus } = this.editor.selection;
    const line = this.layout.line({ blockId, offset: focus });
    const offset = focus > line.start ? previousCharacter(this.valueOf(blockId), focus) : focus;
    this.setMode("normal");
    this.moveTo({ blockId, offset });
  }

  private yankText(blockId: string, from: number, to: number): void {
    if (to <= from) return;
    this.register = { kind: "text", content: slice(getBlock(this.editor.state, blockId).content, from, to) };
  }

  /** Deletes text in a block into the register; with `change`, then enters Insert there. */
  private deleteRange(blockId: string, from: number, to: number, change = false): void {
    this.yankText(blockId, from, to);
    this.editor.runCommand(deleteText(this.editor.state, blockId, from, to));
    if (change) this.insertAt({ blockId, offset: from });
    else this.moveTo({ blockId, offset: from });
  }

  private takeCount(): number {
    const count = this.count === "" ? 1 : Number(this.count);
    this.count = "";
    return count;
  }

  private clearPending(): void {
    this.count = "";
    this.operator = null;
    this.pendingG = false;
    this.leaderAt = null;
  }

  private setMode(mode: VimMode): void {
    if (this.mode === mode) return;
    this.mode = mode;
    this.options.onMode?.(mode);
  }
}
