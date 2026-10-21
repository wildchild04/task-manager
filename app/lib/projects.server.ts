import type { AppServices } from "~/composition";
import type { LibraryNode } from "~/domain/library/library.service";
import { byRecency, type DashboardItem, taskItem } from "~/domain/projects/dashboard";

import type { PageView } from "../blocks/view-model";
import { formatDateTime, stateColor, stateLabel } from "./format";
import { type ActionResult, domainError, formValues, invalid } from "./forms.server";
import { buildPageView } from "./page-view.server";

/** Creates a project from the `title` field. */
export function createProjectAction(services: AppServices, formData: FormData): ActionResult {
  const values = formValues(formData);
  if (!values.title) return invalid(values, { title: "A project needs a title" });
  try {
    const project = services.projects.create({ id: crypto.randomUUID(), title: values.title });
    return { ok: true, id: project.id };
  } catch (error) {
    return domainError(error, values);
  }
}

/** One line of a project tab: a task, with an optional marker and a detail line. */
export type ProjectItemView = {
  id: string;
  title: string;
  href: string;
  chip?: { label: string; color: ReturnType<typeof stateColor> | "error" | "warning" };
  /** "Due …" for chores, "Updated …" otherwise. */
  detail: string;
};

export type ProjectTabId = "work" | "explorations" | "updates" | "chores";

export type ProjectTabView = { id: ProjectTabId; title: string; items: ProjectItemView[]; listHref: string };

export type GlanceView = { label: string; color?: "info" | "warning" | "error" };

export type ProjectHomeView = {
  project: { id: string; title: string };
  home: PageView | undefined;
  /** The quick-glance header. */
  glance: GlanceView[];
  tabs: ProjectTabView[];
  /** The knowledge library's documents. */
  library: LibraryNode[];
};

const plural = (n: number, one: string, many = `${one}s`) => `${n} ${n === 1 ? one : many}`;

export function projectHomeView(services: AppServices, projectId: string): ProjectHomeView | undefined {
  const project = services.projects.get(projectId);
  // Uncapped: the tabs list whole sections.
  const dashboard = services.dashboard.getDashboard(projectId, Number.POSITIVE_INFINITY);
  if (!project || !dashboard) return undefined;
  const timeZone = services.tasks.timeZone;
  const section = (id: string) => dashboard.find((s) => s.id === id)?.items ?? [];

  const item = (entry: DashboardItem, chip?: ProjectItemView["chip"]): ProjectItemView => ({
    id: entry.id,
    title: entry.title || "Untitled",
    href: `/tasks/${entry.id}`,
    ...(chip ? { chip } : {}),
    detail: entry.dueAt
      ? `Due ${formatDateTime(entry.dueAt, timeZone)}`
      : `Updated ${formatDateTime(services.tasks.get(entry.id)!.updatedAt, timeZone)}`,
  });
  const stateChip = (state: string) => ({ label: stateLabel(state), color: stateColor(state) });

  const inProgress = section("work-in-progress");
  const returned = section("returned-work");
  const returnedIds = new Set(returned.map((t) => t.id));
  const todo = byRecency(services.tasks.list(projectId, { kind: "work", state: "todo" }))
    .filter((t) => !returnedIds.has(t.id))
    .map(taskItem);
  const explorations = section("open-explorations");
  const updates = section("open-updates");
  const chores = section("chores");
  const urgent = chores.filter((c) => c.urgent).length;
  const nextDue = chores
    .map((c) => c.dueAt)
    .filter((d): d is string => !!d)
    .sort()[0];

  const glance: GlanceView[] = [
    { label: `${todo.length + returned.length} to do` },
    { label: `${inProgress.length} in progress`, ...(inProgress.length ? { color: "info" as const } : {}) },
    ...(returned.length ? [{ label: `${returned.length} returned`, color: "warning" as const }] : []),
    { label: plural(explorations.length, "open exploration") },
    ...(updates.length ? [{ label: plural(updates.length, "open update") }] : []),
    { label: `${plural(chores.length, "chore")}${nextDue ? ` · next due ${formatDateTime(nextDue, timeZone)}` : ""}` },
    ...(urgent ? [{ label: `${urgent} urgent`, color: "error" as const }] : []),
  ];

  const list = (slug: string) => `/projects/${project.id}/${slug}`;
  return {
    project: { id: project.id, title: project.title || "Untitled" },
    home: buildPageView(services.blocks, project.homePageId, services.suggestions, services.content),
    glance,
    tabs: [
      {
        id: "work",
        title: "Work",
        listHref: list("work"),
        // In progress first, then returned, then the rest of the to-do work.
        items: [
          ...inProgress.map((t) => item(t, stateChip("in_progress"))),
          ...returned.map((t) => item(t, { label: "Returned", color: "warning" })),
          ...todo.map((t) => item(t, stateChip("todo"))),
        ],
      },
      { id: "explorations", title: "Explorations", listHref: list("explorations"), items: explorations.map((t) => item(t)) },
      { id: "updates", title: "Updates", listHref: list("updates"), items: updates.map((t) => item(t)) },
      {
        id: "chores",
        title: "Chores",
        listHref: list("chores"),
        items: chores.map((t) => item(t, t.urgent ? { label: "Urgent", color: "error" } : undefined)),
      },
    ],
    library: services.library.getLibraryTree(project.id) ?? [],
  };
}

/** What deleting a project removes, for its confirmation: its title and how many tasks and library documents go with it. */
export type ProjectDeletion = { title: string; tasks: number; documents: number };

export function projectDeletion(services: AppServices, projectId: string): ProjectDeletion | undefined {
  const project = services.projects.get(projectId);
  if (!project) return undefined;
  const count = (nodes: readonly { children: readonly unknown[] }[]): number =>
    nodes.reduce((sum, node) => sum + 1 + count(node.children as { children: readonly unknown[] }[]), 0);
  return {
    title: project.title || "Untitled",
    tasks: services.tasks.list(projectId).length,
    documents: count(services.library.getLibraryTree(projectId) ?? []),
  };
}
