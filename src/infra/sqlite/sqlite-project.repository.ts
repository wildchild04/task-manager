import type Database from "better-sqlite3";

import type { ProjectRepository } from "~/domain/projects/project.repository";
import type { Project } from "~/domain/projects/types";

const selectColumns = `id, home_page_id AS homePageId, library_root_id AS libraryRootId,
  created_at AS createdAt, updated_at AS updatedAt`;

export class SqliteProjectRepository implements ProjectRepository {
  private readonly statements;

  constructor(db: Database.Database) {
    this.statements = {
      insert: db.prepare(
        `INSERT INTO projects (id, home_page_id, library_root_id, created_at, updated_at)
         VALUES (@id, @homePageId, @libraryRootId, @createdAt, @updatedAt)`,
      ),
      get: db.prepare<[string], Project>(`SELECT ${selectColumns} FROM projects WHERE id = ?`),
      list: db.prepare<[], Project>(`SELECT ${selectColumns} FROM projects ORDER BY created_at, rowid`),
    };
  }

  insert(project: Project): void {
    this.statements.insert.run(project);
  }

  get(id: string): Project | undefined {
    return this.statements.get.get(id);
  }

  list(): Project[] {
    return this.statements.list.all();
  }
}
