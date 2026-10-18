import { beforeEach, describe, expect, it } from "vitest";

import type { AppServices, ServiceOptions } from "~/composition";
import { BatchError } from "~/domain/blocks/errors";
import type { Operation } from "~/domain/blocks/types";
import { ProjectError } from "~/domain/projects/project.service";

export type ServicesFactory = (options?: ServiceOptions) => AppServices;

const text = (value: string) => [{ text: value }];

function catchError(run: () => unknown): unknown {
  try {
    run();
  } catch (error) {
    return error;
  }
  throw new Error("Expected an error");
}

export function projectContract(name: string, factory: ServicesFactory) {
  describe(`${name}: project and knowledge library contract`, () => {
    let services: AppServices;

    beforeEach(() => {
      services = factory();
    });

    /** Inserts a document page at the top level of a project's library (or under `parentId`). */
    const doc = (projectId: string, id: string, title: string, parentId?: string, afterId?: string): Operation => ({
      op: "insert",
      block: { id, type: "page", content: text(title) },
      parentId: parentId ?? services.projects.get(projectId)!.libraryRootId,
      afterId,
    });

    describe("project", () => {
      it("creates a project with a titled home page and an empty library", () => {
        const project = services.projects.create({ id: "A", title: "Notion task manager" });
        expect(project).toMatchObject({ id: "A", title: "Notion task manager" });
        expect(services.blocks.getBlock(project.homePageId)).toMatchObject({
          type: "page",
          owner: { kind: "project", id: "A" },
          content: text("Notion task manager"),
        });
        expect(services.blocks.getBlock(project.libraryRootId)?.owner).toEqual({ kind: "project", id: "A" });
        expect(services.library.getLibraryTree("A")).toEqual([]);
      });

      it("creates nothing when a page cannot be created", () => {
        // B's library root reuses A's home page ID: B's home page is inserted, then the batch fails.
        const colliding = factoryWithIds(["home-A", "lib-A", "home-B", "home-A"]);
        colliding.projects.create({ id: "A", title: "A" });
        const error = catchError(() => colliding.projects.create({ id: "B", title: "B" }));
        expect(error).toBeInstanceOf(BatchError);
        expect(colliding.projects.get("B")).toBeUndefined();
        expect(colliding.blocks.getBlock("home-B")).toBeUndefined();
        expect(colliding.projects.list().map((p) => p.id)).toEqual(["A"]);
      });

      it("rejects a duplicate project ID", () => {
        services.projects.create({ id: "A", title: "A" });
        const error = catchError(() => services.projects.create({ id: "A", title: "Again" }));
        expect(error).toBeInstanceOf(ProjectError);
        expect(services.projects.list()).toHaveLength(1);
      });

      it("takes its title from the home page", () => {
        const project = services.projects.create({ id: "A", title: "Notion task manager" });
        services.blocks.apply([{ op: "update", id: project.homePageId, content: text("Taskhub") }]);
        expect(services.projects.get("A")?.title).toBe("Taskhub");
      });

      it("keeps references on the home page", () => {
        const project = services.projects.create({ id: "A", title: "A" });
        services.blocks.apply([
          doc("A", "D", "Doc"),
          { op: "insert", block: { id: "R", type: "reference", props: { targetId: "D" } }, parentId: project.homePageId },
        ]);
        expect(services.blocks.loadTree(project.homePageId)?.children?.map((c) => c.block.id)).toEqual(["R"]);
      });

      it("protects the home page and library root from deletion", () => {
        const project = services.projects.create({ id: "A", title: "A" });
        for (const id of [project.homePageId, project.libraryRootId]) {
          const error = catchError(() => services.blocks.apply([{ op: "delete", id }]));
          expect((error as BatchError).error.code).toBe("protected");
        }
      });

      it("keeps project pages out of the workspace root pages", () => {
        services.projects.create({ id: "A", title: "A" });
        services.projects.create({ id: "B", title: "B" });
        expect(services.blocks.listRootPages()).toEqual([]);
      });

      it("deletes a project with its tasks, comments, history, home page and library", () => {
        services.projects.create({ id: "A", title: "Garden" });
        services.blocks.apply([doc("A", "doc", "Plan")]);
        services.tasks.create({ id: "W", projectId: "A", kind: "work", title: "Dig" });
        services.tasks.create({ id: "E", projectId: "A", kind: "exploration", title: "Idea" });
        services.tasks.addReference("W", { kind: "task", id: "E" });
        services.tasks.transition("W", "start");
        services.comments.add({ id: "c", taskId: "W", blocks: [{ id: "cp", type: "paragraph", content: text("Hi") }] });
        const project = services.projects.get("A")!;
        const bodies = ["W", "E"].map((id) => services.tasks.get(id)!.bodyPageId);

        services.projects.delete("A");

        expect(services.projects.get("A")).toBeUndefined();
        expect(services.projects.list().map((p) => p.id)).not.toContain("A");
        expect(services.tasks.get("W")).toBeUndefined();
        expect(services.tasks.get("E")).toBeUndefined();
        expect(services.tasks.history("W")).toEqual([]);
        expect(services.tasks.relations("W")).toEqual([]);
        expect(services.comments.get("c")).toBeUndefined();
        for (const id of [project.homePageId, project.libraryRootId, "doc", "cp", ...bodies]) expect(services.blocks.getBlock(id)).toBeUndefined();
      });

      it("keeps references from other projects, resolving as missing", () => {
        services.projects.create({ id: "A", title: "Garden" });
        services.projects.create({ id: "B", title: "Kitchen" });
        services.tasks.create({ id: "WA", projectId: "A", kind: "work", title: "Dig" });
        services.tasks.create({ id: "WB", projectId: "B", kind: "work", title: "Cook" });
        services.tasks.addReference("WB", { kind: "task", id: "WA" });
        services.projects.delete("A");
        expect(services.tasks.get("WB")).toBeDefined();
        expect(services.tasks.relations("WB", "references")[0]!.target).toEqual({ status: "missing", kind: "task", id: "WA" });
      });

      it("refuses deleting an unknown project", () => {
        expect(catchError(() => services.projects.delete("nope"))).toMatchObject({ code: "not_found" });
      });

      it("lists projects oldest first with their titles", () => {
        services.projects.create({ id: "A", title: "First" });
        services.projects.create({ id: "B", title: "Second" });
        expect(services.projects.list().map((p) => [p.id, p.title])).toEqual([
          ["A", "First"],
          ["B", "Second"],
        ]);
      });
    });

    describe("knowledge library", () => {
      beforeEach(() => {
        services.projects.create({ id: "A", title: "A" });
        services.projects.create({ id: "B", title: "B" });
      });

      const titles = (projectId: string) => services.library.getLibraryTree(projectId)!.map((n) => n.title);

      it("nests documents", () => {
        services.blocks.apply([doc("A", "arch", "Architecture"), doc("A", "auth", "Auth design", "arch")]);
        expect(services.library.getLibraryTree("A")).toEqual([
          { id: "arch", title: "Architecture", children: [{ id: "auth", title: "Auth design", children: [] }] },
        ]);
      });

      it("reorders documents", () => {
        services.blocks.apply([doc("A", "a", "A"), doc("A", "b", "B", undefined, "a"), doc("A", "c", "C", undefined, "b")]);
        services.blocks.apply([{ op: "move", id: "c", parentId: services.projects.get("A")!.libraryRootId, afterId: "a" }]);
        expect(titles("A")).toEqual(["A", "C", "B"]);
      });

      it("excludes content blocks but finds pages nested inside them", () => {
        services.blocks.apply([
          doc("A", "arch", "Architecture"),
          { op: "insert", block: { id: "p1", type: "paragraph", content: text("text") }, parentId: "arch" },
          { op: "insert", block: { id: "t", type: "toggle" }, parentId: "arch", afterId: "p1" },
          doc("A", "inner", "Inside a toggle", "t"),
          doc("A", "auth", "Auth design", "arch", "t"),
        ]);
        expect(services.library.getLibraryTree("A")![0]!.children.map((n) => n.title)).toEqual([
          "Inside a toggle",
          "Auth design",
        ]);
      });

      it("deletes a document with its children", () => {
        services.blocks.apply([doc("A", "arch", "Architecture"), doc("A", "auth", "Auth design", "arch")]);
        services.blocks.apply([{ op: "delete", id: "arch" }]);
        expect(services.library.getLibraryTree("A")).toEqual([]);
        expect(services.blocks.getBlock("auth")).toBeUndefined();
      });

      it("moves a document to another project, keeping references", () => {
        services.blocks.apply([
          doc("A", "spec", "Spec"),
          { op: "insert", block: { id: "R", type: "reference", props: { targetId: "spec" } }, parentId: services.projects.get("A")!.homePageId },
        ]);
        services.blocks.apply([{ op: "move", id: "spec", parentId: services.projects.get("B")!.libraryRootId }]);
        expect(titles("A")).toEqual([]);
        expect(titles("B")).toEqual(["Spec"]);
        expect(services.blocks.resolveReference("R", [])).toMatchObject({ status: "ok", target: { id: "spec" } });
        expect(services.library.projectOfPage("spec")).toBe("B");
      });

      it("finds the project of a nested document and of a home page", () => {
        services.blocks.apply([doc("A", "arch", "Architecture"), doc("A", "auth", "Auth design", "arch")]);
        expect(services.library.projectOfPage("auth")).toBe("A");
        expect(services.library.projectOfPage(services.projects.get("B")!.homePageId)).toBe("B");
        expect(services.library.projectOfPage("nope")).toBeUndefined();
      });

      it("returns undefined for an unknown project", () => {
        expect(services.library.getLibraryTree("nope")).toBeUndefined();
      });
    });

    function factoryWithIds(ids: string[]): AppServices {
      const queue = [...ids];
      return factory({ newId: () => queue.shift() ?? crypto.randomUUID() });
    }
  });
}
