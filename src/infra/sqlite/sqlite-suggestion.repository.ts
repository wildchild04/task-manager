import type Database from "better-sqlite3";

import type { SuggestionRepository } from "~/domain/suggestions/suggestion.repository";
import type { Suggestion } from "~/domain/suggestions/types";

type SuggestionRow = {
  id: string;
  page_id: string;
  action: Suggestion["action"];
  target_id: string | null;
  note: string | null;
  actor_name: string;
  base: string | null;
  status: Suggestion["status"];
  undo: string | null;
  created_at: string;
  resolved_at: string | null;
};

const toSuggestion = (row: SuggestionRow): Suggestion => ({
  id: row.id,
  pageId: row.page_id,
  action: row.action,
  targetId: row.target_id,
  note: row.note,
  author: row.actor_name,
  base: row.base,
  status: row.status,
  undo: row.undo === null ? null : JSON.parse(row.undo),
  createdAt: row.created_at,
  resolvedAt: row.resolved_at,
});

const values = (s: Suggestion) => [
  s.pageId,
  s.action,
  s.targetId,
  s.note,
  s.author,
  s.base,
  s.status,
  s.undo === null ? null : JSON.stringify(s.undo),
  s.createdAt,
  s.resolvedAt,
  s.id,
];

export class SqliteSuggestionRepository implements SuggestionRepository {
  private readonly s;

  constructor(db: Database.Database) {
    this.s = {
      insert: db.prepare(
        `INSERT INTO suggestions (page_id, action, target_id, note, actor_name, base, status, undo, created_at, resolved_at, id)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      ),
      update: db.prepare(
        `UPDATE suggestions SET page_id = ?, action = ?, target_id = ?, note = ?, actor_name = ?, base = ?, status = ?,
         undo = ?, created_at = ?, resolved_at = ? WHERE id = ?`,
      ),
      get: db.prepare<[string], SuggestionRow>("SELECT * FROM suggestions WHERE id = ?"),
      listPending: db.prepare<[], SuggestionRow>("SELECT * FROM suggestions WHERE status = 'pending' ORDER BY created_at, rowid"),
    };
  }

  insert(suggestion: Suggestion): void {
    this.s.insert.run(...values(suggestion));
  }

  get(id: string): Suggestion | undefined {
    const row = this.s.get.get(id);
    return row && toSuggestion(row);
  }

  update(suggestion: Suggestion): void {
    this.s.update.run(...values(suggestion));
  }

  listPending(): Suggestion[] {
    return this.s.listPending.all().map(toSuggestion);
  }
}
