import type { Operation, SimpleMark } from "~/domain/blocks/types";

import * as commands from "./commands";
import type { CommandResult, DeleteUnit } from "./commands";
import { applyOps, caret, type EditorState, getBlock, invert, isCollapsed, type Selection } from "./editor-state";
import { length } from "./rich-text";
import { History } from "./history";

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
  /** Toggles that are closed. Local to this view, never saved. */
  closed: ReadonlySet<string> = new Set();
  private history = new History();
  private readonly listeners = new Set<() => void>();
  private readonly newId: () => string;
  private readonly now: () => number;

  constructor(
    state: EditorState,
    private readonly options: EditorOptions = {},
  ) {
    this.state = state;
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
    for (const listener of this.listeners) listener();
  }

  /** Replaces the whole state (after loading newer content from the server). Undo history no longer applies to it. */
  reset(state: EditorState): void {
    this.state = state;
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

  lineBreak(): void {
    this.run(commands.insertText(this.state, this.selection, "\n"));
  }

  deleteBackward(unit: DeleteUnit = "character"): boolean {
    const atEdge = isCollapsed(this.selection) && this.selection.focus === 0;
    return this.run(commands.deleteBackward(this.state, this.selection, this.context, unit), this.typingKey(atEdge));
  }

  deleteForward(unit: DeleteUnit = "character"): boolean {
    const atEdge = isCollapsed(this.selection) && this.selection.focus >= length(getBlock(this.state, this.selection.blockId).content);
    return this.run(commands.deleteForward(this.state, this.selection, this.context, unit), this.typingKey(atEdge));
  }

  /** Deleting inside a block merges with typing in it; at its edges it's a structural step of its own. */
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

  toggleMark(mark: SimpleMark): boolean {
    return this.run(commands.toggleMark(this.state, this.selection, mark));
  }

  setLink(href: string | null): boolean {
    return this.run(commands.setLink(this.state, this.selection, href));
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
