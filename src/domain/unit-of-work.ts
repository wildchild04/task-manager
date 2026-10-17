import type { BlockRepository } from "./blocks/block.repository";
import type { ProjectRepository } from "./projects/project.repository";
import type { TaskRepository } from "./tasks/task.repository";

/** Every repository, bound to the same store so they can share a transaction. */
export type Repositories = {
  blocks: BlockRepository;
  projects: ProjectRepository;
  tasks: TaskRepository;
};

/**
 * Runs work that spans several repositories atomically: if `work` throws,
 * nothing it wrote is kept. `work` must be synchronous.
 */
export interface UnitOfWork {
  /** The repositories, for reads outside a unit of work. */
  readonly repositories: Repositories;
  run<T>(work: (repositories: Repositories) => T): T;
}
