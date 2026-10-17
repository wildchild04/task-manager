import type Database from "better-sqlite3";

import type { ApplyOptions, BlockRepository } from "~/domain/blocks/block.repository";
import type { Batch, Block, BlockType, Owner, TreeNode } from "~/domain/blocks/types";
import type { ProtectionHooks } from "~/domain/blocks/validate";
import { applyBatch } from "~/infra/shared/apply-batch";
import type { BlockRow, RowStore } from "~/infra/shared/row-store";
import { buildTree, orderedChildren, rowToBlock } from "~/infra/shared/rows";

type SqlRow = {
  id: string;
  type: BlockType;
  parent_id: string | null;
  prev_id: string | null;
  owner_kind: string | null;
  owner_id: string | null;
  props: string;
  content: string;
  target_id: string | null;
  created_at: string;
  updated_at: string;
};

const columns: Record<Exclude<keyof BlockRow, "id">, keyof SqlRow> = {
  type: "type",
  parentId: "parent_id",
  prevId: "prev_id",
  ownerKind: "owner_kind",
  ownerId: "owner_id",
  props: "props",
  content: "content",
  targetId: "target_id",
  createdAt: "created_at",
  updatedAt: "updated_at",
};

function fromSql(row: SqlRow): BlockRow {
  return {
    id: row.id,
    type: row.type,
    parentId: row.parent_id,
    prevId: row.prev_id,
    ownerKind: row.owner_kind,
    ownerId: row.owner_id,
    props: JSON.parse(row.props),
    content: JSON.parse(row.content),
    targetId: row.target_id,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

function toSqlValue(key: keyof BlockRow, value: unknown) {
  return key === "props" || key === "content" ? JSON.stringify(value) : value;
}

class SqliteRowStore implements RowStore {
  private readonly statements;

  constructor(private readonly db: Database.Database) {
    const ordered = "parent_id IS ? AND owner_kind IS NULL";
    this.statements = {
      get: db.prepare<[string], SqlRow>("SELECT * FROM blocks WHERE id = ?"),
      childrenOf: db.prepare<[string | null], SqlRow>(`SELECT * FROM blocks WHERE ${ordered}`),
      successorOf: db.prepare<[string | null, string | null], SqlRow>(
        `SELECT * FROM blocks WHERE ${ordered} AND prev_id IS ?`,
      ),
      descendantIds: db
        .prepare<[string], string>(
          `WITH RECURSIVE sub(id) AS (
             SELECT id FROM blocks WHERE parent_id = ?
             UNION ALL
             SELECT b.id FROM blocks b JOIN sub ON b.parent_id = sub.id
           )
           SELECT id FROM sub`,
        )
        .pluck(),
      treeRows: db.prepare<[string], SqlRow>(
        `WITH RECURSIVE sub(id, type) AS (
           SELECT id, type FROM blocks WHERE parent_id = ?
           UNION ALL
           SELECT b.id, b.type FROM blocks b JOIN sub ON b.parent_id = sub.id WHERE sub.type <> 'page'
         )
         SELECT blocks.* FROM blocks JOIN sub ON blocks.id = sub.id`,
      ),
      ownedRoots: db.prepare<[string, string], SqlRow>(
        "SELECT * FROM blocks WHERE owner_kind = ? AND owner_id = ? ORDER BY created_at, rowid",
      ),
      referencesTo: db.prepare<[string], SqlRow>("SELECT * FROM blocks WHERE target_id = ?"),
      insert: db.prepare(
        `INSERT INTO blocks (id, type, parent_id, prev_id, owner_kind, owner_id, props, content, target_id, created_at, updated_at)
         VALUES (@id, @type, @parent_id, @prev_id, @owner_kind, @owner_id, @props, @content, @target_id, @created_at, @updated_at)`,
      ),
    };
  }

  get(id: string) {
    const row = this.statements.get.get(id);
    return row ? fromSql(row) : undefined;
  }

  childrenOf(parentId: string | null) {
    return this.statements.childrenOf.all(parentId).map(fromSql);
  }

  successorOf(parentId: string | null, prevId: string | null) {
    const row = this.statements.successorOf.get(parentId, prevId);
    return row ? fromSql(row) : undefined;
  }

  descendantIds(id: string) {
    return this.statements.descendantIds.all(id);
  }

  treeRows(rootId: string) {
    return this.statements.treeRows.all(rootId).map(fromSql);
  }

  ownedRoots(kind: string, id: string) {
    return this.statements.ownedRoots.all(kind, id).map(fromSql);
  }

  referencesTo(targetId: string) {
    return this.statements.referencesTo.all(targetId).map(fromSql);
  }

  insert(row: BlockRow) {
    const values: Record<string, unknown> = { id: row.id };
    for (const [key, column] of Object.entries(columns)) {
      values[column] = toSqlValue(key as keyof BlockRow, row[key as keyof BlockRow]);
    }
    this.statements.insert.run(values);
  }

  update(id: string, patch: Partial<Omit<BlockRow, "id">>) {
    const keys = Object.keys(patch) as (keyof typeof columns)[];
    if (keys.length === 0) return;
    const assignments = keys.map((key) => `${columns[key]} = @${columns[key]}`).join(", ");
    const values: Record<string, unknown> = { id };
    for (const key of keys) values[columns[key]] = toSqlValue(key, patch[key]);
    this.db.prepare(`UPDATE blocks SET ${assignments} WHERE id = @id`).run(values);
  }

  delete(ids: readonly string[]) {
    const statement = this.db.prepare("DELETE FROM blocks WHERE id = ?");
    for (const id of ids) statement.run(id);
  }
}

/**
 * SQLite implementation. `apply` runs in a better-sqlite3 transaction, which
 * becomes a savepoint when called inside an outer transaction (a unit of work).
 * Expects the schema to be migrated already.
 */
export class SqliteBlockRepository implements BlockRepository {
  private readonly store: SqliteRowStore;
  private readonly applyInTransaction;

  constructor(db: Database.Database, hooks: ProtectionHooks = {}) {
    this.store = new SqliteRowStore(db);
    this.applyInTransaction = db.transaction((batch: Batch, options?: ApplyOptions) =>
      applyBatch(this.store, batch, hooks, options),
    );
  }

  async getBlock(id: string): Promise<Block | undefined> {
    const row = this.store.get(id);
    return row ? rowToBlock(row) : undefined;
  }

  async getChildren(parentId: string | null): Promise<Block[]> {
    return orderedChildren(this.store, parentId);
  }

  async loadTree(rootId: string): Promise<TreeNode | undefined> {
    return buildTree(this.store, rootId);
  }

  async getOwnedRoots(owner: Owner): Promise<Block[]> {
    return this.store.ownedRoots(owner.kind, owner.id).map(rowToBlock);
  }

  async listIncomingReferences(targetId: string): Promise<Block[]> {
    return this.store.referencesTo(targetId).map(rowToBlock);
  }

  async apply(batch: Batch, options?: ApplyOptions): Promise<void> {
    this.applyInTransaction(batch, options);
  }
}
