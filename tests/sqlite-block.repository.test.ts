import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

import Database from "better-sqlite3";
import { afterEach, describe, expect, it } from "vitest";

import { BlockService } from "~/domain/blocks/block.service";
import { migrate } from "~/infra/sqlite/migrate";
import { SqliteBlockRepository } from "~/infra/sqlite/sqlite-block.repository";

import { blockRepositoryContract } from "./contract/block-repository.contract";

const tempDirs: string[] = [];
const openDbs: Database.Database[] = [];

function tempDbPath() {
  const dir = mkdtempSync(join(tmpdir(), "ntm-blocks-"));
  tempDirs.push(dir);
  return join(dir, "test.sqlite");
}

function open(path: string) {
  const db = new Database(path);
  openDbs.push(db);
  migrate(db);
  return db;
}

afterEach(() => {
  for (const db of openDbs.splice(0)) if (db.open) db.close();
  for (const dir of tempDirs.splice(0)) rmSync(dir, { recursive: true, force: true });
});

blockRepositoryContract("sqlite", (hooks) => {
  const db = open(tempDbPath());
  return {
    repo: new SqliteBlockRepository(db, hooks),
    corruptOrder: (id, prevId) => db.prepare("UPDATE blocks SET prev_id = ? WHERE id = ?").run(prevId, id),
  };
});

describe("sqlite: durable persistence", () => {
  it("survives closing and reopening the database", async () => {
    const path = tempDbPath();
    const first = open(path);
    const before = new BlockService(new SqliteBlockRepository(first));
    await before.apply([
      { op: "insert", block: { id: "P", type: "page", content: [{ text: "Page" }] }, parentId: null },
      { op: "insert", block: { id: "T", type: "toggle" }, parentId: "P" },
      { op: "insert", block: { id: "T1", type: "todo", props: { checked: true } }, parentId: "T" },
      { op: "insert", block: { id: "R", type: "reference", props: { targetId: "T1" } }, parentId: "P", afterId: "T" },
    ]);
    const tree = await before.loadTree("P");
    first.close();

    const after = new BlockService(new SqliteBlockRepository(open(path)));
    expect(await after.loadTree("P")).toEqual(tree);
    expect((await after.listIncomingReferences("T1")).map((b) => b.id)).toEqual(["R"]);
  });

  it("migrates a fresh database and starts with no root pages", async () => {
    const db = new Database(tempDbPath());
    openDbs.push(db);
    expect(migrate(db)).toEqual(["001_blocks.sql"]);
    expect(migrate(db)).toEqual([]);
    expect(await new BlockService(new SqliteBlockRepository(db)).listRootPages()).toEqual([]);
  });

  it("nests apply inside an outer transaction as a savepoint", async () => {
    const db = open(tempDbPath());
    const blocks = new SqliteBlockRepository(db);
    const outer = db.transaction(() => {
      void blocks.apply([{ op: "insert", block: { id: "P", type: "page" }, parentId: null }]);
      throw new Error("abort the unit of work");
    });
    expect(() => outer()).toThrow("abort the unit of work");
    expect(await blocks.getBlock("P")).toBeUndefined();
  });

  it("enforces sibling order in the database itself", () => {
    const db = open(tempDbPath());
    const insert = db.prepare(
      "INSERT INTO blocks (id, type, parent_id, prev_id, created_at, updated_at) VALUES (?, 'page', NULL, NULL, '', '')",
    );
    insert.run("P1");
    expect(() => insert.run("P2")).toThrow(/UNIQUE/);
  });
});
