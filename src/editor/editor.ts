import type { MarkdownBlock } from "~/domain/blocks/markdown";
import { type CalloutTone, MENTION_TEXT, type Operation, type SimpleMark } from "~/domain/blocks/types";

import type { SlashCommand } from "./block-types";
import { pasteBlocks } from "./clipboard";
import * as commands from "./commands";
import type { CommandResult, DeleteUnit } from "./commands";
import { applyOps, caret, type EditorState, getBlock, invert, isCollapsed, type Selection } from "./editor-state";
import { length, plain } from "./rich-text";
import { History } from "./history";
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
  selection: Selection;
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
    this.history = new History();
    this.notify();
  }

  setSelection(selection: Selection): void {
    this.selection = selection;
  }

  /** Applies a command's result as one undo step. Returns whether anything happened. */
  private run(result: CommandResult | null, key?: string): boolean {
    if (!result) return false;
    const before = this.selection;
    if (result.ops.length > 0) {
      const inverse = invert(this.state, result.ops);
      this.state = applyOps(this.state, result.ops);
      this.history.push({ ops: result.ops, inverse, before, after: result.selection, key, at: this.now() });
      this.options.onOps?.(result.ops);
    }
    this.selection = result.selection;
    this.notify();
    return true;
  }

  // ----- Edits -----

  /** Types text at the selection. A space or `-` may complete a markdown shortcut, which is its own undo step. */
  type(inserted: string): void {
    this.run(commands.insertText(this.state, this.selection, inserted), `type:${this.selection.blockId}`);
    if (inserted === " ") this.run(commands.markdownShortcut(this.state, this.selection));
    if (inserted === "-") this.run(commands.dividerShortcut(this.state, this.selection, this.context));
  }

  /** Pastes blocks at the selection as one undo step; `false` where only plain text can be pasted (code, cells, the title). */
  paste(blocks: readonly MarkdownBlock[]): boolean {
    return this.run(pasteBlocks(this.state, this.selection, blocks, this.newId));
  }

  lineBreak(): void {
    this.run(commands.insertText(this.state, this.selection, "\n"));
  }

  deleteBackward(unit: DeleteUnit = "character"): boolean {
    const atEdge = (isCollapsed(this.selection) && this.selection.focus === 0) || this.touchesMention(-1);
    return this.run(commands.deleteBackward(this.state, this.selection, this.context, unit), this.typingKey(atEdge));
  }

  deleteForward(unit: DeleteUnit = "character"): boolean {
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
    this.run(commands.splitBlock(this.state, this.selection, this.context));
  }

  indent(): boolean {
    return this.run(commands.indent(this.state, this.selection));
  }

  outdent(): boolean {
    return this.run(commands.outdent(this.state, this.selection));
  }

  /**
   * Tab (Shift+Tab with `backward`): in a table cell, the next (previous) cell, adding a row after the last;
   * in code, indents (outdents) the line; elsewhere, nests (un-nests) the block.
   */
  tab(backward = false): boolean {
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
    this.selection = entry.before;
    this.options.onOps?.(entry.inverse);
    this.notify();
    return true;
  }

  redo(): boolean {
    const entry = this.history.redo();
    if (!entry) return false;
    this.state = applyOps(this.state, entry.ops);
    this.selection = entry.after;
    this.options.onOps?.(entry.ops);
    this.notify();
    return true;
  }
}
