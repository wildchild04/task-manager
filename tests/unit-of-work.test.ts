import Database from "better-sqlite3";
import { describe, expect, it } from "vitest";

import type { UnitOfWork } from "~/domain/unit-of-work";
import { MemoryBlockRepository } from "~/infra/memory/memory-block.repository";
import { MemoryCommentRepository } from "~/infra/memory/memory-comment.repository";
import { MemorySuggestionRepository } from "~/infra/memory/memory-suggestion.repository";
import { MemoryProjectRepository } from "~/infra/memory/memory-project.repository";
import { MemoryTaskRepository } from "~/infra/memory/memory-task.repository";
import { MemoryUnitOfWork } from "~/infra/memory/memory-unit-of-work";
import { migrate } from "~/infra/sqlite/migrate";
import { SqliteBlockRepository } from "~/infra/sqlite/sqlite-block.repository";
import { SqliteCommentRepository } from "~/infra/sqlite/sqlite-comment.repository";
import { SqliteSuggestionRepository } from "~/infra/sqlite/sqlite-suggestion.repository";
import { SqliteProjectRepository } from "~/infra/sqlite/sqlite-project.repository";
import { SqliteTaskRepository } from "~/infra/sqlite/sqlite-task.repository";
import { SqliteUnitOfWork } from "~/infra/sqlite/sqlite-unit-of-work";

function memory(): UnitOfWork {
  const blocks = new MemoryBlockRepository();
  const projects = new MemoryProjectRepository();
  const tasks = new MemoryTaskRepository();
  const comments = new MemoryCommentRepository();
  const suggestions = new MemorySuggestionRepository();
  return new MemoryUnitOfWork({ blocks, projects, tasks, comments, suggestions }, [blocks, projects, tasks, comments, suggestions]);
}

function sqlite(): UnitOfWork {
  const db = new Database(":memory:");
  migrate(db);
  return new SqliteUnitOfWork(db, {
    blocks: new SqliteBlockRepository(db),
    projects: new SqliteProjectRepository(db),
    tasks: new SqliteTaskRepository(db),
    comments: new SqliteCommentRepository(db),
    suggestions: new SqliteSuggestionRepository(db),
  });
}

const project = { id: "A", homePageId: "H", libraryRootId: "L", createdAt: "t", updatedAt: "t" };

describe.each([
  ["memory", memory],
  ["sqlite", sqlite],
])("%s unit of work", (_name, create) => {
  it("commits writes across repositories", () => {
    const uow = create();
    uow.run(({ blocks, projects }) => {
      blocks.apply([{ op: "insert", block: { id: "H", type: "page" }, owner: { kind: "project", id: "A" } }]);
      projects.insert(project);
    });
    expect(uow.repositories.blocks.getBlock("H")).toBeDefined();
    expect(uow.repositories.projects.get("A")).toEqual(project);
  });

  it("rolls back every repository when the work throws after writing", () => {
    const uow = create();
    expect(() =>
      uow.run(({ blocks, projects }) => {
        blocks.apply([{ op: "insert", block: { id: "H", type: "page" }, owner: { kind: "project", id: "A" } }]);
        projects.insert(project);
        throw new Error("fail after writing");
      }),
    ).toThrow("fail after writing");
    expect(uow.repositories.blocks.getBlock("H")).toBeUndefined();
    expect(uow.repositories.projects.get("A")).toBeUndefined();
  });

  it("rejects asynchronous work", () => {
    const uow = create();
    expect(() => uow.run(async () => {})).toThrow();
  });
});
