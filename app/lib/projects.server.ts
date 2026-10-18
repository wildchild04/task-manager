import type { AppServices } from "~/composition";
import type { DashboardSectionResult } from "~/domain/projects/dashboard";

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

export type DashboardItemView = {
  id: string;
  title: string;
  href: string;
  state?: string;
  stateLabel?: string;
  stateColor?: ReturnType<typeof stateColor>;
  urgent?: boolean;
  due?: string;
};

export type DashboardCardView = { id: string; title: string; count: number; items: DashboardItemView[] };

export type ProjectHomeView = {
  project: { id: string; title: string };
  home: PageView | undefined;
  dashboard: DashboardCardView[];
};

function card(section: DashboardSectionResult, timeZone: string): DashboardCardView {
  return {
    id: section.id,
    title: section.title,
    count: section.count,
    items: section.items.map((item) => ({
      id: item.id,
      title: item.title || "Untitled",
      // Task items have a kind; library items are pages.
      href: item.kind ? `/tasks/${item.id}` : `/pages/${item.id}`,
      ...(item.state ? { state: item.state, stateLabel: stateLabel(item.state), stateColor: stateColor(item.state) } : {}),
      ...(item.urgent !== undefined ? { urgent: item.urgent } : {}),
      ...(item.dueAt ? { due: formatDateTime(item.dueAt, timeZone) } : {}),
    })),
  };
}

export function projectHomeView(services: AppServices, projectId: string): ProjectHomeView | undefined {
  const project = services.projects.get(projectId);
  const dashboard = services.dashboard.getDashboard(projectId);
  if (!project || !dashboard) return undefined;
  return {
    project: { id: project.id, title: project.title || "Untitled" },
    home: buildPageView(services.blocks, project.homePageId),
    dashboard: dashboard.map((section) => card(section, services.tasks.timeZone)),
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
