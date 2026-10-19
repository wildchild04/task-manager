import { BatchError, BlockOperationError } from "~/domain/blocks/errors";
import type { Batch } from "~/domain/blocks/types";
import type { BlockReader, ProtectionHooks, ValidatedOperation } from "~/domain/blocks/validate";
import { validateOperation } from "~/domain/blocks/validate";
import type { ApplyOptions } from "~/domain/blocks/block.repository";

import type { RowStore } from "./row-store";
import { rowToBlock } from "./rows";

/**
 * Parent a block is parked under while it moves. Never visible outside one
 * operation; it keeps the unique (parent, prev) index valid statement by statement.
 */
const DETACHED = "__detached__";

/**
 * Validates and applies every operation of a batch against the store. Must be
 * called inside the caller's transaction: on a `BatchError` the caller rolls back.
 */
export function applyBatch(
  store: RowStore,
  batch: Batch,
  hooks: ProtectionHooks,
  options: ApplyOptions = {},
  now: () => string = () => new Date().toISOString(),
): void {
  const reader: BlockReader = {
    getBlock: (id) => {
      const row = store.get(id);
      return row && row.parentId !== DETACHED ? rowToBlock(row) : undefined;
    },
  };

  // Tables the batch touches, checked for shape once every operation has applied.
  const tables = new Set<string>();
  const noteTables = (op: Batch[number]) => {
    const ids = op.op === "insert" ? [op.block.id, "parentId" in op ? op.parentId : null] : [op.id, op.op === "move" ? op.parentId : null];
    for (const id of ids) {
      if (id === null) continue;
      const block = reader.getBlock(id);
      // A delete leaves its parent to check; anything else, its own nearest table.
      for (let at = op.op === "delete" && id === op.id && block ? reader.getBlock(block.parentId ?? "") : block; at; ) {
        if (at.type === "table") {
          tables.add(at.id);
          break;
        }
        at = at.parentId === null ? undefined : reader.getBlock(at.parentId);
      }
    }
  };

  batch.forEach((op, index) => {
    let validated: ValidatedOperation;
    try {
      validated = validateOperation(op, reader, { hooks, bypassProtectionFor: options.bypassProtectionFor });
    } catch (error) {
      if (error instanceof BlockOperationError) throw new BatchError(index, error);
      throw error;
    }
    noteTables(op);
    write(store, validated, now());
    if (op.op !== "delete") noteTables(op);
  });

  for (const tableId of tables) {
    const problem = tableProblem(store, tableId);
    if (problem) throw new BatchError(batch.length - 1, new BlockOperationError("validation", problem));
  }
}

/** Why a table isn't a whole grid (no rows, an empty row, rows of different lengths), or `undefined` when it is. */
function tableProblem(store: RowStore, tableId: string): string | undefined {
  const table = store.get(tableId);
  if (!table || table.parentId === DETACHED) return undefined;
  const rows = store.childrenOf(tableId);
  if (rows.length === 0) return "A table needs at least one row";
  const widths = rows.map((row) => store.childrenOf(row.id).length);
  if (widths.some((width) => width === 0)) return "A table row needs at least one cell";
  if (widths.some((width) => width !== widths[0])) return "Every row of a table needs the same number of cells";
  return undefined;
}

function write(store: RowStore, op: ValidatedOperation, at: string): void {
  switch (op.kind) {
    case "insert": {
      if (op.owner) {
        store.insert({
          id: op.id,
          type: op.type,
          parentId: null,
          prevId: null,
          ownerKind: op.owner.kind,
          ownerId: op.owner.id,
          props: op.props,
          content: op.content,
          targetId: op.targetId,
          createdAt: at,
          updatedAt: at,
        });
        return;
      }
      // Point the current occupant of the slot at the new block first, so the
      // slot is free when the new block takes it.
      const successor = store.successorOf(op.parentId, op.afterId);
      if (successor) store.update(successor.id, { prevId: op.id });
      store.insert({
        id: op.id,
        type: op.type,
        parentId: op.parentId,
        prevId: op.afterId,
        ownerKind: null,
        ownerId: null,
        props: op.props,
        content: op.content,
        targetId: op.targetId,
        createdAt: at,
        updatedAt: at,
      });
      return;
    }

    case "update":
      store.update(op.id, { type: op.type, props: op.props, content: op.content, targetId: op.targetId, updatedAt: at });
      return;

    case "move": {
      const row = store.get(op.id)!;
      // Detach: park the block, then let its successor take over its old slot.
      const oldSuccessor = store.successorOf(row.parentId, row.id);
      store.update(row.id, { parentId: DETACHED, prevId: null });
      if (oldSuccessor) store.update(oldSuccessor.id, { prevId: row.prevId });
      // Attach: point the new slot's occupant at the block, then take the slot.
      const newSuccessor = store.successorOf(op.parentId, op.afterId);
      if (newSuccessor) store.update(newSuccessor.id, { prevId: row.id });
      store.update(row.id, { parentId: op.parentId, prevId: op.afterId, updatedAt: at });
      return;
    }

    case "delete": {
      const row = store.get(op.id)!;
      const successor = row.ownerKind === null ? store.successorOf(row.parentId, row.id) : undefined;
      store.delete([row.id, ...store.descendantIds(row.id)]);
      if (successor) store.update(successor.id, { prevId: row.prevId });
      return;
    }
  }
}
