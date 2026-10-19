import type { Operation } from "~/domain/blocks/types";

import { caret, caretOrder, type EditorState, getBlock, previousSibling, type Selection } from "./editor-state";
import { length } from "./rich-text";

/** What a table command produces (as `CommandResult`): the operations and where the selection goes. */
type TableResult = { ops: Operation[]; selection: Selection };

/** Where a cell sits: its table and row, and its row and column numbers from 0. */
export type CellPosition = { tableId: string; rowId: string; row: number; column: number };

export function cellPosition(state: EditorState, cellId: string): CellPosition | null {
  const cell = state.blocks[cellId];
  if (cell?.type !== "table_cell" || cell.parentId === null) return null;
  const row = getBlock(state, cell.parentId);
  const table = getBlock(state, row.parentId!);
  return { tableId: table.id, rowId: row.id, row: table.children.indexOf(row.id), column: row.children.indexOf(cellId) };
}

/** The cell at a row and column, if the table has one there. */
export function cellAt(state: EditorState, tableId: string, row: number, column: number): string | undefined {
  const rowId = getBlock(state, tableId).children[row];
  return rowId === undefined ? undefined : getBlock(state, rowId).children[column];
}

/** How many rows and columns a table has (every row has the same number of cells). */
export function tableSize(state: EditorState, tableId: string): { rows: number; columns: number } {
  const rows = getBlock(state, tableId).children;
  return { rows: rows.length, columns: rows[0] ? getBlock(state, rows[0]).children.length : 0 };
}

/** Insert operations for a row of empty cells under `tableId` after `afterId`, and its cells' IDs. */
function newRow(tableId: string, afterId: string | null, columns: number, newId: () => string) {
  const rowId = newId();
  const ops: Operation[] = [{ op: "insert", block: { id: rowId, type: "table_row" }, parentId: tableId, afterId }];
  const cells: string[] = [];
  for (let i = 0; i < columns; i++) {
    const id = newId();
    ops.push({ op: "insert", block: { id, type: "table_cell" }, parentId: rowId, afterId: cells.at(-1) ?? null });
    cells.push(id);
  }
  return { ops, cells };
}

/** Insert operations for a new table of empty cells with a header row, and its first cell. */
export function newTable(parentId: string, afterId: string | null, rows: number, columns: number, newId: () => string) {
  const tableId = newId();
  const ops: Operation[] = [
    { op: "insert", block: { id: tableId, type: "table", props: { headerRow: true, headerColumn: false } }, parentId, afterId },
  ];
  let first: string | undefined;
  let previous: string | null = null;
  for (let i = 0; i < rows; i++) {
    const row = newRow(tableId, previous, columns, newId);
    ops.push(...row.ops);
    first ??= row.cells[0];
    previous = (row.ops[0] as Extract<Operation, { op: "insert" }>).block.id;
  }
  return { ops, tableId, firstCell: first! };
}

// ----- Moving between cells -----

/** Tab (or Shift+Tab, `backward`): the next (previous) cell in reading order; Tab in the last cell adds a row. */
export function tabCell(state: EditorState, cellId: string, backward: boolean, newId: () => string): TableResult | null {
  const at = cellPosition(state, cellId);
  if (!at) return null;
  const { rows, columns } = tableSize(state, at.tableId);
  const index = at.row * columns + at.column + (backward ? -1 : 1);
  if (index < 0) return { ops: [], selection: caret(cellId, 0) };
  if (index < rows * columns)
    return { ops: [], selection: caret(cellAt(state, at.tableId, Math.floor(index / columns), index % columns)!, 0) };
  const row = newRow(at.tableId, at.rowId, columns, newId);
  return { ops: row.ops, selection: caret(row.cells[0]!, 0) };
}

/** Enter in a cell: the cell below in the same column; from the last row, a new row. */
export function cellBelow(state: EditorState, cellId: string, newId: () => string): TableResult | null {
  const at = cellPosition(state, cellId);
  if (!at) return null;
  const below = cellAt(state, at.tableId, at.row + 1, at.column);
  if (below) return { ops: [], selection: caret(below, 0) };
  const row = newRow(at.tableId, at.rowId, tableSize(state, at.tableId).columns, newId);
  return { ops: row.ops, selection: caret(row.cells[at.column]!, 0) };
}

/**
 * ↑ or ↓ from a cell's first or last line: the cell above or below in the same column, or, from the first or
 * last row, the text block before or after the table (`undefined` when there is none).
 */
export function verticalNeighbour(
  state: EditorState,
  cellId: string,
  up: boolean,
  closed?: ReadonlySet<string>,
): string | undefined {
  const at = cellPosition(state, cellId);
  if (!at) return undefined;
  const inTable = cellAt(state, at.tableId, at.row + (up ? -1 : 1), at.column);
  if (inTable) return inTable;
  const { rows, columns } = tableSize(state, at.tableId);
  const edge = up ? cellAt(state, at.tableId, 0, 0)! : cellAt(state, at.tableId, rows - 1, columns - 1)!;
  const order = caretOrder(state, closed);
  return order[order.indexOf(edge) + (up ? -1 : 1)];
}

// ----- Rows and columns -----

/** Where a row or column goes, next to an existing one; by default at the end. */
export type TableSide = "before" | "after";

/** Adds a row of empty cells before or after `at.rowId`, or at the bottom; the caret goes to its first cell. */
export function addRow(
  state: EditorState,
  tableId: string,
  at: { rowId: string; side: TableSide } | undefined,
  newId: () => string,
): TableResult {
  const table = getBlock(state, tableId);
  const afterId = at ? (at.side === "before" ? previousSibling(state, at.rowId) : at.rowId) : (table.children.at(-1) ?? null);
  const row = newRow(tableId, afterId, tableSize(state, tableId).columns, newId);
  return { ops: row.ops, selection: caret(row.cells[0]!, 0) };
}

/** Adds a column of empty cells before or after column `at.column`, or at the right; the caret goes to its first cell. */
export function addColumn(
  state: EditorState,
  tableId: string,
  at: { column: number; side: TableSide } | undefined,
  newId: () => string,
): TableResult {
  const index = at ? at.column + (at.side === "after" ? 1 : 0) : tableSize(state, tableId).columns;
  const ops: Operation[] = [];
  let first: string | undefined;
  for (const rowId of getBlock(state, tableId).children) {
    const id = newId();
    first ??= id;
    ops.push({
      op: "insert",
      block: { id, type: "table_cell" },
      parentId: rowId,
      afterId: getBlock(state, rowId).children[index - 1] ?? null,
    });
  }
  return { ops, selection: caret(first!, 0) };
}

/** Moves a row one place up (`-1`) or down (`1`); nothing when it's already at that end. */
export function moveRow(state: EditorState, rowId: string, step: -1 | 1, selection: Selection): TableResult | null {
  const { parentId } = getBlock(state, rowId);
  const rows = getBlock(state, parentId!).children;
  const index = rows.indexOf(rowId);
  if (index + step < 0 || index + step >= rows.length) return null;
  const afterId = step === -1 ? (rows[index - 2] ?? null) : rows[index + 1]!;
  return { ops: [{ op: "move", id: rowId, parentId: parentId!, afterId }], selection };
}

/** Moves a column one place left (`-1`) or right (`1`): each row's cell moves; nothing at the edge. */
export function moveColumn(
  state: EditorState,
  tableId: string,
  column: number,
  step: -1 | 1,
  selection: Selection,
): TableResult | null {
  if (column + step < 0 || column + step >= tableSize(state, tableId).columns) return null;
  const ops: Operation[] = getBlock(state, tableId).children.map((rowId) => {
    const cells = getBlock(state, rowId).children;
    const afterId = step === -1 ? (cells[column - 2] ?? null) : cells[column + 1]!;
    return { op: "move", id: cells[column]!, parentId: rowId, afterId };
  });
  return { ops, selection };
}

/** The selection, or, when it is in a removed cell, the start of `fallback`. */
const caretAway = (selection: Selection, removed: (cellId: string) => boolean, fallback: string): Selection =>
  removed(selection.blockId) ? caret(fallback, 0) : selection;

/** Deletes a row; refused when it is the table's only row. */
export function deleteRow(state: EditorState, rowId: string, selection: Selection): TableResult | null {
  const { parentId } = getBlock(state, rowId);
  const at = cellPosition(state, getBlock(state, rowId).children[0]!)!;
  const rows = getBlock(state, parentId!).children;
  if (rows.length === 1) return null;
  const column = cellPosition(state, selection.blockId)?.column ?? 0;
  const fallback = cellAt(state, at.tableId, at.row + 1, column) ?? cellAt(state, at.tableId, at.row - 1, column)!;
  return {
    ops: [{ op: "delete", id: rowId }],
    selection: caretAway(selection, (id) => getBlock(state, id).parentId === rowId, fallback),
  };
}

/** Deletes a column (each row's cell at it); refused when it is the table's only column. */
export function deleteColumn(state: EditorState, tableId: string, column: number, selection: Selection): TableResult | null {
  const { columns } = tableSize(state, tableId);
  if (columns === 1) return null;
  const cells = getBlock(state, tableId).children.map((rowId) => getBlock(state, rowId).children[column]!);
  const row = cellPosition(state, selection.blockId)?.row ?? 0;
  const fallback = cellAt(state, tableId, row, column + 1) ?? cellAt(state, tableId, row, column - 1)!;
  return {
    ops: cells.map((id) => ({ op: "delete", id })),
    selection: caretAway(selection, (id) => cells.includes(id), fallback),
  };
}

/** Turns the header row or header column on or off. */
export function toggleHeader(
  state: EditorState,
  tableId: string,
  which: "headerRow" | "headerColumn",
  selection: Selection,
): TableResult {
  return { ops: [{ op: "update", id: tableId, props: { [which]: getBlock(state, tableId).props[which] !== true } }], selection };
}

/** Deletes the whole table; a caret inside it goes to the end of the text block before it. */
export function deleteTable(
  state: EditorState,
  tableId: string,
  selection: Selection,
  closed?: ReadonlySet<string>,
): TableResult {
  const inside = cellPosition(state, selection.blockId)?.tableId === tableId;
  if (!inside) return { ops: [{ op: "delete", id: tableId }], selection };
  const order = caretOrder(state, closed);
  const before = order[order.indexOf(cellAt(state, tableId, 0, 0)!) - 1] ?? state.rootId;
  return { ops: [{ op: "delete", id: tableId }], selection: caret(before, length(getBlock(state, before).content)) };
}
