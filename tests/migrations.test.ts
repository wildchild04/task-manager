import { copyFileSync, mkdtempSync, readdirSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

import Database from "better-sqlite3";
import { afterEach, describe, expect, it } from "vitest";

import { defaultMigrationsDir, migrate } from "~/infra/sqlite/migrate";
import { SqliteSuggestionRepository } from "~/infra/sqlite/sqlite-suggestion.repository";

describe("007_action_suggestions", () => {
  const dirs: string[] = [];
  afterEach(() => dirs.splice(0).forEach((dir) => rmSync(dir, { recursive: true, force: true })));

  /** A database migrated up to (not including) `stop`. */
  function migratedUpTo(stop: string): Database.Database {
    const dir = mkdtempSync(join(tmpdir(), "migrations-"));
    dirs.push(dir);
    for (const file of readdirSync(defaultMigrationsDir).filter((f) => f < stop)) {
      copyFileSync(join(defaultMigrationsDir, file), join(dir, file));
    }
    const db = new Database(":memory:");
    migrate(db, dir);
    return db;
  }

  it("keeps every block suggestion, with no subject", () => {
    const db = migratedUpTo("007");
    const insert = db.prepare(
      `INSERT INTO suggestions (id, page_id, action, target_id, note, actor_name, base, status, undo, created_at, resolved_at)
       VALUES (?, 'P', ?, ?, ?, 'builder', ?, ?, ?, ?, ?)`,
    );
    insert.run("a", "insert", null, "From the audit", null, "pending", null, "2026-10-19T08:00:00.000Z", null);
    insert.run("b", "delete", "T", null, '{"type":"paragraph"}', "rejected", "[]", "2026-10-19T08:00:01.000Z", "2026-10-19T09:00:00.000Z");

    expect(migrate(db)[0]).toBe("007_action_suggestions.sql");
    const repo = new SqliteSuggestionRepository(db);
    expect(repo.get("a")).toMatchObject({ subject: null, action: "insert", targetId: null, note: "From the audit", status: "pending" });
    expect(repo.get("b")).toMatchObject({ subject: null, action: "delete", targetId: "T", status: "rejected", undo: [] });
    expect(repo.listPending().map((s) => s.id)).toEqual(["a"]);
  });

  it("stores action suggestions and refuses inconsistent rows", () => {
    const db = new Database(":memory:");
    migrate(db);
    const repo = new SqliteSuggestionRepository(db);
    repo.insert({
      id: "r",
      pageId: "P",
      subject: { kind: "page", id: "P" },
      action: "rename",
      payload: { action: "rename", title: "Roadmap 2027" },
      targetId: null,
      note: null,
      author: "builder",
      base: "Roadmap",
      status: "pending",
      undo: null,
      createdAt: "2026-10-19T08:00:00.000Z",
      resolvedAt: null,
    });
    expect(repo.get("r")).toMatchObject({ subject: { kind: "page", id: "P" }, payload: { title: "Roadmap 2027" } });

    const raw = db.prepare(
      `INSERT INTO suggestions (id, page_id, action, subject_kind, subject_id, actor_name, status, created_at)
       VALUES (?, 'P', ?, ?, ?, 'builder', 'pending', '2026-10-19T08:00:00.000Z')`,
    );
    expect(() => raw.run("x", "rename", null, null)).toThrow(/CHECK/);
    expect(() => raw.run("y", "delete", "task", null)).toThrow(/CHECK/);
  });
});

describe("008_accounts", () => {
  it("allows one working token per agent name, freeing it on revoke", () => {
    const db = new Database(":memory:");
    migrate(db);
    const insert = db.prepare(
      `INSERT INTO agent_tokens (id, name, token_hash, prefix, created_at, revoked_at) VALUES (?, 'claude', ?, 'ntm_abcd', '2026-11-01', ?)`,
    );
    insert.run("a", "h1", null);
    expect(() => insert.run("b", "h2", null)).toThrow(/UNIQUE/);
    db.prepare("UPDATE agent_tokens SET revoked_at = '2026-11-02' WHERE id = 'a'").run();
    expect(() => insert.run("b", "h2", null)).not.toThrow();
  });
});
