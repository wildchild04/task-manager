import type { ProjectRepository } from "~/domain/projects/project.repository";
import type { Project } from "~/domain/projects/types";

export class MemoryProjectRepository implements ProjectRepository {
  private projects = new Map<string, Project>();

  insert(project: Project): void {
    this.projects = new Map(this.projects).set(project.id, project);
  }

  get(id: string): Project | undefined {
    return this.projects.get(id);
  }

  list(): Project[] {
    // Map iteration follows insertion order, which is creation order.
    return [...this.projects.values()];
  }

  snapshot(): Map<string, Project> {
    return this.projects;
  }

  restore(snapshot: Map<string, Project>): void {
    this.projects = snapshot;
  }
}
