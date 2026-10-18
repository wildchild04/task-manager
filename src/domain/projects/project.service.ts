import { plainText } from "../blocks/text";
import type { ProtectionHook } from "../blocks/validate";
import type { UnitOfWork } from "../unit-of-work";
import type { Project, ProjectSummary } from "./types";
import { COMMENT_OWNER_KIND } from "../comments/types";
import { TASK_OWNER_KIND } from "../tasks/types";
import { PROJECT_OWNER_KIND } from "./types";

export class ProjectError extends Error {
  constructor(
    readonly code: "duplicate_id" | "validation" | "not_found",
    message: string,
  ) {
    super(message);
    this.name = "ProjectError";
  }
}

/** A project's home page and library root can be edited but never deleted through block batches. */
export const projectProtection: ProtectionHook = ({ op, targetIsRoot }) =>
  op.op === "delete" && targetIsRoot ? "A project's home page and knowledge library cannot be deleted" : undefined;

export type CreateProjectInput = { id: string; title: string };

export class ProjectService {
  constructor(
    private readonly uow: UnitOfWork,
    private readonly newId: () => string = () => crypto.randomUUID(),
    private readonly now: () => string = () => new Date().toISOString(),
  ) {}

  /** Creates the project, its home page and its library root together. */
  create({ id, title }: CreateProjectInput): ProjectSummary {
    if (!id) throw new ProjectError("validation", "A project needs an ID");
    const owner = { kind: PROJECT_OWNER_KIND, id };
    const at = this.now();
    const project: Project = {
      id,
      homePageId: this.newId(),
      libraryRootId: this.newId(),
      createdAt: at,
      updatedAt: at,
    };

    this.uow.run(({ blocks, projects }) => {
      if (projects.get(id)) throw new ProjectError("duplicate_id", `Project ${id} already exists`);
      blocks.apply([
        { op: "insert", block: { id: project.homePageId, type: "page", content: [{ text: title }] }, owner },
        { op: "insert", block: { id: project.libraryRootId, type: "page" }, owner },
      ]);
      projects.insert(project);
    });
    return this.summarize(project);
  }

  /**
   * Deletes the project and everything it holds, in one unit of work: each
   * task's comments, body page, history and relations from it, then the home
   * page and the library (with every page in it), then the project. Pointers
   * from elsewhere (references, mentions) are kept and resolve as missing.
   */
  delete(id: string): void {
    this.uow.run((repos) => {
      const project = repos.projects.get(id);
      if (!project) throw new ProjectError("not_found", `Project ${id} does not exist`);
      // The owning domains' protection stops ordinary edits from removing these roots; this removes them on purpose.
      const bypass = { bypassProtectionFor: [PROJECT_OWNER_KIND, TASK_OWNER_KIND, COMMENT_OWNER_KIND] };
      for (const task of repos.tasks.list(id)) {
        for (const comment of repos.comments.listByTask(task.id)) {
          repos.blocks.apply([{ op: "delete", id: comment.bodyBlockId }], bypass);
          repos.comments.delete(comment.id);
        }
        repos.blocks.apply([{ op: "delete", id: task.bodyPageId }], bypass);
        repos.tasks.delete(task.id);
      }
      repos.blocks.apply(
        [
          { op: "delete", id: project.homePageId },
          { op: "delete", id: project.libraryRootId },
        ],
        bypass,
      );
      repos.projects.delete(id);
    });
  }

  get(id: string): ProjectSummary | undefined {
    const project = this.uow.repositories.projects.get(id);
    return project && this.summarize(project);
  }

  /** All projects, oldest first. */
  list(): ProjectSummary[] {
    return this.uow.repositories.projects.list().map((project) => this.summarize(project));
  }

  private summarize(project: Project): ProjectSummary {
    const home = this.uow.repositories.blocks.getBlock(project.homePageId);
    return { ...project, title: home ? plainText(home.content) : "" };
  }
}
