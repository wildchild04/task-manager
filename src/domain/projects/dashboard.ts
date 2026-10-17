import type { BlockService } from "../blocks/block.service";
import type { ChoreService } from "../chores/chore.service";
import { choreAttributes } from "../chores/schedule";
import type { TaskService } from "../tasks/task.service";
import type { TaskKind, TaskSummary } from "../tasks/types";
import type { ProjectService } from "./project.service";

/** A dashboard row: a task (with kind and state) or, for the library, a page. Chores add urgency and due time. */
export type DashboardItem = {
  id: string;
  title: string;
  kind?: TaskKind;
  state?: string;
  urgent?: boolean;
  dueAt?: string;
};

export type DashboardSectionResult = { id: string; title: string; count: number; items: DashboardItem[] };

export type DashboardSection = {
  id: string;
  title: string;
  /** All matching items, most recently updated first; the dashboard counts them and keeps the first `limit`. */
  query(projectId: string): DashboardItem[];
};

/**
 * Sections in display order. Later changes add theirs (`register`) or change
 * how an existing one orders items (`replace`), e.g. urgent chores first.
 */
export class DashboardRegistry {
  private sections: DashboardSection[] = [];

  register(section: DashboardSection, position: { after?: string } = {}): void {
    if (this.sections.some((s) => s.id === section.id)) throw new Error(`Section ${section.id} is already registered`);
    const index = position.after === undefined ? -1 : this.sections.findIndex((s) => s.id === position.after);
    if (position.after !== undefined && index === -1) throw new Error(`No section ${position.after} to insert after`);
    if (index === -1) this.sections.push(section);
    else this.sections.splice(index + 1, 0, section);
  }

  replace(section: DashboardSection): void {
    const index = this.sections.findIndex((s) => s.id === section.id);
    if (index === -1) throw new Error(`No section ${section.id} to replace`);
    this.sections[index] = section;
  }

  list(): readonly DashboardSection[] {
    return this.sections;
  }
}

/** Most recently updated first; ties go to the later-created item. */
export function byRecency<T extends { updatedAt: string }>(items: readonly T[]): T[] {
  return [...items].reverse().sort((a, b) => b.updatedAt.localeCompare(a.updatedAt));
}

export const taskItem = (task: TaskSummary): DashboardItem => ({ id: task.id, title: task.title, kind: task.kind, state: task.state });

/** Registers the six sections defined by `project-structure`. */
export function registerCoreSections(
  registry: DashboardRegistry,
  { tasks, blocks, projects }: { tasks: TaskService; blocks: BlockService; projects: ProjectService },
): void {
  const taskSection = (id: string, title: string, kind: TaskKind, state: string, keep = (_: TaskSummary) => true) =>
    registry.register({
      id,
      title,
      query: (projectId) => byRecency(tasks.list(projectId, { kind, state }).filter(keep)).map(taskItem),
    });

  const lastTransition = (task: TaskSummary) => tasks.history(task.id).at(-1)?.name;

  taskSection("work-in-progress", "Work in progress", "work", "in_progress");
  taskSection("returned-work", "Returned work", "work", "todo", (task) => lastTransition(task) === "return");
  taskSection("open-explorations", "Open explorations", "exploration", "open");
  taskSection("open-updates", "Open updates", "update", "open");
  taskSection("chores", "Chores", "chore", "todo");
  registry.register({
    id: "library",
    title: "Knowledge library",
    query: (projectId) => {
      const project = projects.get(projectId);
      const documents = project ? blocks.getChildren(project.libraryRootId).filter((b) => b.type === "page") : [];
      return byRecency(documents).map((page) => ({
        id: page.id,
        title: page.content.map((span) => span.text).join(""),
      }));
    },
  });
}

export class DashboardService {
  constructor(
    private readonly registry: DashboardRegistry,
    private readonly projects: ProjectService,
  ) {}

  /** Every section, computed now, each with its total count and up to `limit` items. */
  getDashboard(projectId: string, limit = 5): DashboardSectionResult[] | undefined {
    if (!this.projects.get(projectId)) return undefined;
    return this.registry.list().map((section) => {
      const items = section.query(projectId);
      return { id: section.id, title: section.title, count: items.length, items: items.slice(0, limit) };
    });
  }
}

/**
 * The chores section from `task-chore`: urgent (including overdue) first,
 * then soonest due (no due time last), then most recently updated.
 */
export function choresSection(tasks: TaskService, chores: ChoreService): DashboardSection {
  return {
    id: "chores",
    title: "Chores",
    query: (projectId) => {
      const rows = byRecency(tasks.list(projectId, { kind: "chore", state: "todo" })).map((task) => {
        const { dueAt } = choreAttributes(task);
        return { task, urgent: chores.isUrgent(task), due: dueAt ? Date.parse(dueAt) : Number.POSITIVE_INFINITY, dueAt };
      });
      // Array.prototype.sort is stable, so recency breaks the remaining ties.
      rows.sort((a, b) => Number(b.urgent) - Number(a.urgent) || a.due - b.due);
      return rows.map(({ task, urgent, dueAt }) => ({ ...taskItem(task), urgent, ...(dueAt ? { dueAt } : {}) }));
    },
  };
}
