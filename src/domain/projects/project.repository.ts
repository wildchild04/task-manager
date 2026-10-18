import type { Project } from "./types";

export interface ProjectRepository {
  insert(project: Project): void;
  get(id: string): Project | undefined;
  /** All projects, oldest first. */
  list(): Project[];
  delete(id: string): void;
}
