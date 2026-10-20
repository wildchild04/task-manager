import type { MarkdownBlock } from "~/domain/blocks/markdown";
import { type CalloutTone, MENTION_TEXT, type Operation, type SimpleMark } from "~/domain/blocks/types";

import { behaviorOf, type SlashCommand } from "./block-types";
import { pasteBlocks, pasteOverBlocks } from "./clipboard";
import * as commands from "./commands";
import type { CommandResult, DeleteUnit } from "./commands";
import {
  applyOps,
  type BlockRange,
  caret,
  coveredBlocks,
  documentOrder,
  type EditorState,
  getBlock,
  invert,
  isCollapsed,
  selectableOf,
  selectableOrder,
  selectedRoots,
  type Selection,
  type SelectionSnapshot,
  type TextRange,
} from "./editor-state";
import { length, plain } from "./rich-text";
import { History } from "./history";
import * as across from "./selection";
import type { DropTarget } from "./selection";
import * as tables from "./tables";
import type { TableSide } from "./tables";

/** Every toggle of a state, folded. */
const foldedToggles = (state: EditorState): Set<string> =>
  new Set(Object.values(state.blocks).filter((block) => block.type === "toggle").map((block) => block.id));

export type EditorOptions = {
  newId?: () => string;
  now?: () => number;
  /** Called with every batch applied locally (edits, undo and redo), in order, to be saved. */
  onOps?: (ops: Operation[]) => void;
};

/**
 * The editing session of one page: state, selection, open toggles and undo
 * history. Every edit runs a command, applies its operations locally, records
 * their inverse and hands them to `onOps` for saving. No DOM, no React.
 */
export class Editor {
  state: EditorState;
  /** The caret or text selection in one block; while `range` or `blocks` is set, where the caret goes back to. */
  selection: Selection;
  /** Text selected across blocks, or `null`. */
  range: TextRange | null = null;
  /** Whole blocks selected, or `null`. At most one of `range` and `blocks` is set. */
  blocks: BlockRange | null = null;
  /** Increases on every change, for views subscribing to the editor. */
  revision = 0;
  /**
   * Toggles that are closed. Local to this view, never saved. Toggles start
   * folded when the page loads; ones created while editing start open.
   */
  closed: ReadonlySet<string>;
  private history = new History();
  private readonly listeners = new Set<() => void>();
  private readonly newId: () => string;
  private readonly now: () => number;

  constructor(
    state: EditorState,
    private readonly options: EditorOptions = {},
  ) {
    this.state = state;
    this.closed = foldedToggles(state);
    this.selection = caret(state.rootId, 0);
    this.newId = options.newId ?? (() => crypto.randomUUID());
    this.now = options.now ?? (() => Date.now());
  }

  private get context() {
    return { newId: this.newId, closed: this.closed };
  }

  subscribe(listener: () => void): () => void {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  }

  private notify() {
    this.revision += 1;
    for (const listener of this.listeners) listener();
  }

  /** Replaces the whole state (after loading newer content from the server). Undo history no longer applies to it. */
  reset(state: EditorState): void {
    // Toggles open before the reset stay open; all others (including new ones) start folded.
    const open = new Set(Object.values(this.state.blocks).filter((b) => b.type === "toggle" && !this.closed.has(b.id)).map((b) => b.id));
    this.state = state;
    this.closed = new Set([...foldedToggles(state)].filter((id) => !open.has(id)));
    if (!state.blocks[this.selection.blockId]) this.selection = caret(state.rootId, 0);
    if (this.range && !(state.blocks[this.range.anchor.blockId] && state.blocks[this.range.focus.blockId])) this.range = null;
    if (this.blocks && !(state.blocks[this.blocks.anchor] && state.blocks[this.blocks.focus])) this.blocks = null;
    this.history = new History();
    this.notify();
  }

  /** Puts the caret or a text selection in one block, leaving any range or block selection. */
  setSelection(selection: Selection): void {
    const leaving = this.blocks !== null;
    this.selection = selection;
    this.range = null;
    this.blocks = null;
    if (leaving) this.notify();
  }

  /** Selects text across blocks; the caret goes back to its focus when the range ends. */
  setRange(range: TextRange): void {
    const leaving = this.blocks !== null;
    this.range = range;
    this.blocks = null;
    this.selection = caret(range.focus.blockId, range.focus.offset);
    if (leaving) this.notify();
  }

  /** Selects whole blocks, or with `null` ends a block selection (the caret stays where it was). */
  selectBlocks(blocks: BlockRange | null): void {
    this.blocks = blocks;
    this.range = null;
    this.notify();
  }

  private get snapshot(): SelectionSnapshot {
    return { selection: this.selection, range: this.range, blocks: this.blocks };
  }

  private restore(snapshot: SelectionSnapshot) {
    this.selection = snapshot.selection;
    this.range = snapshot.range;
    this.blocks = snapshot.blocks;
  }

  /** Applies a command's result as one undo step. Returns whether anything happened. */
  private run(result: CommandResult | null, key?: string): boolean {
    if (!result) return false;
    const before = this.snapshot;
    const after: SelectionSnapshot = { selection: result.selection, range: result.range ?? null, blocks: result.blocks ?? null };
    if (result.ops.length > 0) {
      const inverse = invert(this.state, result.ops);
      this.state = applyOps(this.state, result.ops);
      this.history.push({ ops: result.ops, inverse, before, after, key, at: this.now() });
      this.options.onOps?.(result.ops);
    }
    this.restore(after);
    this.notify();
    return true;
  }

  // ----- Edits -----

  /** Types text at the selection. A space or `-` may complete a markdown shortcut, which is its own undo step. */
  type(inserted: string): void {
    if (this.range) this.overRange((state, at) => commands.insertText(state, at, inserted));
    else this.run(commands.insertText(this.state, this.selection, inserted), `type:${this.selection.blockId}`);
    if (inserted === " ") this.run(commands.markdownShortcut(this.state, this.selection));
    if (inserted === "-") this.run(commands.dividerShortcut(this.state, this.selection, this.context));
  }

  /** Pastes blocks at the selection as one undo step; `false` where only plain text can be pasted (code, cells, the title). */
  paste(blocks: readonly MarkdownBlock[]): boolean {
    if (this.blocks) return this.run(pasteOverBlocks(this.state, this.selectedRoots(), blocks));
    if (this.range) {
      // Where blocks can't be pasted at the join, the caller types the plain text over the range instead.
      const removed = across.replaceRange(this.state, this.range);
      const pasted = removed && pasteBlocks(applyOps(this.state, removed.ops), removed.selection, blocks, this.newId);
      return pasted ? this.run({ ...pasted, ops: [...removed.ops, ...pasted.ops] }) : false;
    }
    return this.run(pasteBlocks(this.state, this.selection, blocks, this.newId));
  }

  lineBreak(): void {
    if (this.range) this.overRange((state, at) => commands.insertText(state, at, "\n"));
    else this.run(commands.insertText(this.state, this.selection, "\n"));
  }

  /**
   * Removes the text selected across blocks, then runs `then` at the join, as
   * one batch and one undo step.
   */
  private overRange(then?: (state: EditorState, at: Selection) => CommandResult | null): boolean {
    const removed = this.range && across.replaceRange(this.state, this.range);
    if (!removed) return false;
    const next = then?.(applyOps(this.state, removed.ops), removed.selection);
    return this.run(next ? { ...next, ops: [...removed.ops, ...next.ops] } : removed);
  }

  /** Removes the selected text across blocks, or the selected blocks (cutting, after the clipboard is written). */
  removeSelection(): boolean {
    if (this.blocks) return this.deleteBlocks();
    return this.overRange();
  }

  deleteBackward(unit: DeleteUnit = "character"): boolean {
    if (this.range || this.blocks) return this.removeSelection();
    const atEdge = (isCollapsed(this.selection) && this.selection.focus === 0) || this.touchesMention(-1);
    return this.run(commands.deleteBackward(this.state, this.selection, this.context, unit), this.typingKey(atEdge));
  }

  deleteForward(unit: DeleteUnit = "character"): boolean {
    if (this.range || this.blocks) return this.removeSelection();
    const atEdge =
      (isCollapsed(this.selection) && this.selection.focus >= length(getBlock(this.state, this.selection.blockId).content)) ||
      this.touchesMention(1);
    return this.run(commands.deleteForward(this.state, this.selection, this.context, unit), this.typingKey(atEdge));
  }

  /** Whether the character just before (-1) or after (1) a collapsed caret is a mention. */
  private touchesMention(side: -1 | 1): boolean {
    if (!isCollapsed(this.selection)) return false;
    const value = plain(getBlock(this.state, this.selection.blockId).content);
    return value[this.selection.focus + (side === -1 ? -1 : 0)] === MENTION_TEXT;
  }

  /** Deleting inside a block merges with typing in it; at its edges, or deleting a mention, it's a step of its own. */
  private typingKey(atEdge: boolean): string | undefined {
    return atEdge ? undefined : `type:${this.selection.blockId}`;
  }

  enter(): void {
    if (this.range) this.overRange((state, at) => commands.splitBlock(state, at, this.context));
    else this.run(commands.splitBlock(this.state, this.selection, this.context));
  }

  indent(): boolean {
    if (this.blocks) return this.runOnBlocks(across.nestBlocks(this.state, this.selectedRoots()));
    return this.run(commands.indent(this.state, this.selection));
  }

  outdent(): boolean {
    if (this.blocks) return this.runOnBlocks(across.unnestBlocks(this.state, this.selectedRoots()));
    return this.run(commands.outdent(this.state, this.selection));
  }

  /**
   * Tab (Shift+Tab with `backward`): in a table cell, the next (previous) cell, adding a row after the last;
   * in code, indents (outdents) the line; elsewhere, nests (un-nests) the block.
   */
  tab(backward = false): boolean {
    if (this.blocks) return backward ? this.outdent() : this.indent();
    const { blockId } = this.selection;
    const { type } = getBlock(this.state, blockId);
    if (type === "table_cell") return this.run(tables.tabCell(this.state, blockId, backward, this.newId));
    if (type === "code") return this.run(commands.indentCode(this.state, this.selection, backward));
    return backward ? this.outdent() : this.indent();
  }

  /** Cmd/Ctrl+Enter: leaves a code block for a new paragraph after it. Returns false outside code. */
  exitBlock(): boolean {
    return this.run(commands.exitCode(this.state, this.selection, this.context));
  }

  // ----- Whole blocks (each one undo step) -----

  /** The selected blocks the block commands act on (a selected block brings its children), in order. */
  selectedRoots(): string[] {
    return this.blocks ? selectedRoots(this.state, this.blocks, this.closed) : [];
  }

  /** Runs operations on the selected blocks, keeping them selected. */
  private runOnBlocks(ops: Operation[] | null, blocks = this.blocks): boolean {
    return this.run(ops && { ops, selection: this.selection, blocks: blocks ?? undefined });
  }

  /** Selects the block holding `id` (its table, for a cell). */
  selectBlock(id: string): void {
    const block = selectableOf(this.state, id);
    this.selectBlocks({ anchor: block, focus: block });
  }

  /** Selects every block of the page. */
  selectAll(): void {
    const order = selectableOrder(this.state, this.closed);
    if (order.length > 0) this.selectBlocks({ anchor: order[0]!, focus: order.at(-1)! });
  }

  /** Selects the blocks the text range touches. */
  rangeToBlocks(): void {
    if (!this.range) return;
    this.selectBlocks({ anchor: selectableOf(this.state, this.range.anchor.blockId), focus: selectableOf(this.state, this.range.focus.blockId) });
  }

  /** ↑/↓ in a block selection: selects the previous or next block alone, or with `extend` moves the selection's focus. */
  stepBlocks(step: -1 | 1, extend: boolean): void {
    if (!this.blocks) return;
    const order = selectableOrder(this.state, this.closed);
    const next = order[order.indexOf(this.blocks.focus) + step];
    if (!next) return;
    this.selectBlocks(extend ? { anchor: this.blocks.anchor, focus: next } : { anchor: next, focus: next });
  }

  /** Whether a block is part of the block selection (selected, or inside a selected block). */
  isSelected(id: string): boolean {
    if (!this.blocks) return false;
    const covered = new Set(coveredBlocks(this.state, this.blocks, this.closed));
    for (let at: string | null = id; at !== null; at = getBlock(this.state, at).parentId) if (covered.has(at)) return true;
    return false;
  }

  /** Extends the block selection (or starts one at the caret's block) to the block holding `id`. */
  extendBlocks(id: string): void {
    const anchor = this.blocks?.anchor ?? selectableOf(this.state, this.selection.blockId);
    this.selectBlocks({ anchor: anchor === this.state.rootId ? selectableOf(this.state, id) : anchor, focus: selectableOf(this.state, id) });
  }

  /** Enter in a block selection: the caret goes to the end of the last selected text block, or the start of the next one. */
  editBlocks(): void {
    const roots = this.selectedRoots();
    if (roots.length === 0) return;
    const covered = new Set<string>();
    const add = (id: string) => {
      covered.add(id);
      getBlock(this.state, id).children.forEach(add);
    };
    roots.forEach(add);
    const order = documentOrder(this.state, this.closed);
    const isText = (id: string) => behaviorOf(getBlock(this.state, id).type).text;
    const inside = order.filter((id) => covered.has(id) && isText(id)).at(-1);
    if (inside) return this.setSelection(caret(inside, length(getBlock(this.state, inside).content)));
    const end = Math.max(...order.map((id, i) => (covered.has(id) ? i : -1)));
    const after = order.slice(end + 1).find(isText);
    this.setSelection(after ? caret(after, 0) : this.selection);
  }

  /** Whether the selected blocks can be deleted, duplicated, or moved up (`-1`) or down (`1`): for disabling menu items. */
  canActOnBlocks(action: "delete" | "duplicate" | -1 | 1): boolean {
    const roots = this.selectedRoots();
    if (action === "delete" || action === "duplicate") return roots.some((id) => !across.containsProtected(this.state, id));
    return across.moveBlocks(this.state, roots, action) !== null;
  }

  deleteBlocks(): boolean {
    return this.run(across.deleteBlocks(this.state, this.selectedRoots(), this.newId, this.closed));
  }

  duplicateBlocks(): boolean {
    return this.run(across.duplicateBlocks(this.state, this.selectedRoots(), this.selection, this.newId));
  }

  /**
   * Cmd/Ctrl+Shift+↑/↓: moves the selected blocks, or the caret's block (a
   * cell's row), up or down.
   */
  moveBlocks(step: -1 | 1): boolean {
    if (this.blocks) return this.runOnBlocks(across.moveBlocks(this.state, this.selectedRoots(), step));
    const { blockId } = this.selection;
    if (blockId === this.state.rootId) return false;
    const cell = tables.cellPosition(this.state, blockId);
    if (cell) return this.run(tables.moveRow(this.state, cell.rowId, step, this.selection));
    const ops = across.moveBlocks(this.state, [blockId], step);
    return this.run(ops && { ops, selection: this.selection });
  }

  /** Drops blocks (the selection, or one block that becomes the selection) at a target. */
  dropBlocks(roots: readonly string[], target: DropTarget): boolean {
    return this.runOnBlocks(across.dropBlocks(this.state, roots, target), { anchor: roots[0]!, focus: roots.at(-1)! });
  }

  // ----- Tables (each one undo step) -----

  /** Adds a row of empty cells before or after a row, or at the bottom; the caret goes to its first cell. */
  addTableRow(tableId: string, at?: { rowId: string; side: TableSide }): boolean {
    return this.run(tables.addRow(this.state, tableId, at, this.newId));
  }

  /** Adds a column of empty cells before or after column `at.column` (from 0), or at the right. */
  addTableColumn(tableId: string, at?: { column: number; side: TableSide }): boolean {
    return this.run(tables.addColumn(this.state, tableId, at, this.newId));
  }

  /** Moves a row up (`-1`) or down (`1`). */
  moveTableRow(rowId: string, step: -1 | 1): boolean {
    return this.run(tables.moveRow(this.state, rowId, step, this.selection));
  }

  /** Moves column `column` (from 0) left (`-1`) or right (`1`). */
  moveTableColumn(tableId: string, column: number, step: -1 | 1): boolean {
    return this.run(tables.moveColumn(this.state, tableId, column, step, this.selection));
  }

  /** Deletes a row; refused (false) when it's the table's only row. */
  deleteTableRow(rowId: string): boolean {
    return this.run(tables.deleteRow(this.state, rowId, this.selection));
  }

  /** Deletes column `column` (from 0); refused (false) when it's the table's only column. */
  deleteTableColumn(tableId: string, column: number): boolean {
    return this.run(tables.deleteColumn(this.state, tableId, column, this.selection));
  }

  /** Turns a table's header row or header column on or off. */
  toggleTableHeader(tableId: string, which: "headerRow" | "headerColumn"): boolean {
    return this.run(tables.toggleHeader(this.state, tableId, which, this.selection));
  }

  deleteTable(tableId: string): boolean {
    return this.run(tables.deleteTable(this.state, tableId, this.selection, this.closed));
  }

  // ----- Code and callouts -----

  /** Sets a code block's language; empty for plain text. */
  setCodeLanguage(id: string, language: string): boolean {
    return this.run(commands.setCodeLanguage(this.state, id, language, this.selection));
  }

  /** Changes a callout's emoji, tone, or both. */
  setCalloutStyle(id: string, style: { emoji?: string; tone?: CalloutTone }): boolean {
    return this.run(commands.setCalloutStyle(this.state, id, style, this.selection));
  }

  toggleMark(mark: SimpleMark): boolean {
    return this.run(commands.toggleMark(this.state, this.selection, mark));
  }

  setLink(href: string | null): boolean {
    return this.run(commands.setLink(this.state, this.selection, href));
  }

  /** Applies a slash command typed as `/query` from `start` to the caret in the current block. */
  slash(start: number, command: SlashCommand): void {
    const { blockId, focus } = this.selection;
    this.run(commands.slashCommand(this.state, blockId, start, focus, command, this.context));
  }

  /** Turns the `@query` typed from `start` to the caret into a mention of a page. */
  mention(start: number, pageId: string): void {
    this.run(commands.mentionPage(this.state, this.selection, start, pageId));
  }

  toggleTodo(id: string): void {
    this.run(commands.toggleTodo(this.state, id, this.selection));
  }

  /** Opens or closes a toggle. Only the view changes; nothing is saved or undone. */
  toggleOpen(id: string): void {
    const closed = new Set(this.closed);
    if (closed.has(id)) closed.delete(id);
    else closed.add(id);
    this.closed = closed;
    // A caret inside a toggle that closes moves to the toggle.
    if (closed.has(id) && this.isInside(this.selection.blockId, id)) this.selection = caret(id, 0);
    this.notify();
  }

  private isInside(blockId: string, ancestorId: string): boolean {
    for (let id: string | null = getBlock(this.state, blockId).parentId; id !== null; id = getBlock(this.state, id).parentId) {
      if (id === ancestorId) return true;
    }
    return false;
  }

  // ----- History -----

  undo(): boolean {
    const entry = this.history.undo();
    if (!entry) return false;
    this.state = applyOps(this.state, entry.inverse);
    this.restore(entry.before);
    this.options.onOps?.(entry.inverse);
    this.notify();
    return true;
  }

  redo(): boolean {
    const entry = this.history.redo();
    if (!entry) return false;
    this.state = applyOps(this.state, entry.ops);
    this.restore(entry.after);
    this.options.onOps?.(entry.ops);
    this.notify();
    return true;
  }
}
