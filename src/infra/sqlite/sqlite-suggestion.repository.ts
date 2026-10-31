import type Database from "better-sqlite3";

import type { SuggestionRepository } from "~/domain/suggestions/suggestion.repository";
import type { ActionPayload, ActionSuggestion, BlockSuggestion, SubjectKind, Suggestion } from "~/domain/suggestions/types";

type SuggestionRow = {
  id: string;
  page_id: string;
  action: Suggestion["action"];
  target_id: string | null;
  subject_kind: SubjectKind | null;
  subject_id: string | null;
  payload: string | null;
  note: string | null;
  actor_name: string;
  base: string | null;
  status: Suggestion["status"];
  undo: string | null;
  created_at: string;
  resolved_at: string | null;
};

function toSuggestion(row: SuggestionRow): Suggestion {
  const common = {
    id: row.id,
    pageId: row.page_id,
    note: row.note,
    author: row.actor_name,
    base: row.base,
    status: row.status,
    createdAt: row.created_at,
    resolvedAt: row.resolved_at,
  };
  if (row.subject_kind !== null) {
    return {
      ...common,
      subject: { kind: row.subject_kind, id: row.subject_id! },
      action: row.action as ActionSuggestion["action"],
      payload: JSON.parse(row.payload!) as ActionPayload,
      targetId: null,
      undo: null,
    };
  }
  return {
    ...common,
    subject: null,
    action: row.action as BlockSuggestion["action"],
    targetId: row.target_id,
    undo: row.undo === null ? null : JSON.parse(row.undo),
  };
}

const values = (s: Suggestion) => [
  s.pageId,
  s.action,
  s.targetId,
  s.subject?.kind ?? null,
  s.subject?.id ?? null,
  s.subject ? JSON.stringify(s.payload) : null,
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
        `INSERT INTO suggestions (page_id, action, target_id, subject_kind, subject_id, payload, note, actor_name, base, status,
         undo, created_at, resolved_at, id)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      ),
      update: db.prepare(
        `UPDATE suggestions SET page_id = ?, action = ?, target_id = ?, subject_kind = ?, subject_id = ?, payload = ?, note = ?, actor_name = ?, base = ?, status = ?,
         undo = ?, created_at = ?, resolved_at = ? WHERE id = ?`,
      ),
      get: db.prepare<[string], SuggestionRow>("SELECT * FROM suggestions WHERE id = ?"),
      findByPrefix: db.prepare<[{ prefix: string }], SuggestionRow>(
        "SELECT * FROM suggestions WHERE substr(id, 1, length(@prefix)) = @prefix",
      ),
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

  findByPrefix(prefix: string): Suggestion[] {
    return this.s.findByPrefix.all({ prefix }).map(toSuggestion);
  }

  listPending(): Suggestion[] {
    return this.s.listPending.all().map(toSuggestion);
  }
}
