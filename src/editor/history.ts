import type { Operation } from "~/domain/blocks/types";

import type { SelectionSnapshot } from "./editor-state";

/** One undoable step: what it did, how to undo it, and what was selected before and after it. */
export type HistoryEntry = {
  ops: Operation[];
  inverse: Operation[];
  before: SelectionSnapshot;
  after: SelectionSnapshot;
  /** Steps with the same key close together merge (typing in one block). */
  key?: string;
  at: number;
};

/** Typing pauses longer than this start a new undo step. */
export const TYPING_PAUSE_MS = 1000;

export class History {
  private undoStack: HistoryEntry[] = [];
  private redoStack: HistoryEntry[] = [];

  /** Records a step, merging it into the last one when both are typing in the same block without a pause. */
  push(entry: HistoryEntry): void {
    this.redoStack = [];
    const last = this.undoStack.at(-1);
    if (last && entry.key && last.key === entry.key && entry.at - last.at < TYPING_PAUSE_MS) {
      this.undoStack[this.undoStack.length - 1] = {
        ops: [...last.ops, ...entry.ops],
        // Undoing both: first this step's inverse, then the earlier one's.
        inverse: [...entry.inverse, ...last.inverse],
        before: last.before,
        after: entry.after,
        key: entry.key,
        at: entry.at,
      };
      return;
    }
    this.undoStack.push(entry);
  }

  /** Takes the last step to undo; it moves to the redo stack. */
  undo(): HistoryEntry | undefined {
    const entry = this.undoStack.pop();
    if (entry) this.redoStack.push({ ...entry, key: undefined });
    return entry;
  }

  /** Takes the last undone step to redo; it moves back to the undo stack. */
  redo(): HistoryEntry | undefined {
    const entry = this.redoStack.pop();
    if (entry) this.undoStack.push({ ...entry, key: undefined });
    return entry;
  }

  get canUndo(): boolean {
    return this.undoStack.length > 0;
  }

  get canRedo(): boolean {
    return this.redoStack.length > 0;
  }
}
