import type { AppServices } from "~/composition";
import type { LibraryNode } from "~/domain/library/library.service";

import { isTaskListSlug, slugOfKind, type TaskListSlug } from "./format";
import { type NotificationItem, notificationsView } from "./home.server";
import { workspacePageTree } from "./page-search.server";

export type ProjectSection = "home" | TaskListSlug | "library";

export type ShellView = {
  projects: { id: string; title: string }[];
  /**
   * The project being viewed (directly, or through one of its tasks or pages),
   * its current section, its library tree, and the open document if any.
   */
  current: {
    id: string;
    title: string;
    section: ProjectSection;
    library: LibraryNode[];
    activePageId: string | null;
  } | null;
  /** The workspace's pages as a tree. */
  pages: LibraryNode[];
  /** What waits for the human, for the notification bell. */
  notifications: NotificationItem[];
};

/** Works out which project and section the URL belongs to. */
function currentProject(services: AppServices, pathname: string): ShellView["current"] {
  const [first, id, sub] = pathname.split("/").filter(Boolean);
  let projectId: string | undefined;
  let section: ProjectSection = "home";

  if (first === "projects" && id) {
    projectId = id;
    if (sub === "library") section = "library";
    else if (isTaskListSlug(sub)) section = sub;
  } else if (first === "tasks" && id) {
    const task = services.tasks.get(id);
    projectId = task?.projectId;
    if (task) section = slugOfKind(task.kind);
  } else if (first === "pages" && id) {
    projectId = services.library.projectOfPage(id);
    section = projectId && services.projects.get(projectId)?.homePageId === id ? "home" : "library";
  }

  const project = projectId ? services.projects.get(projectId) : undefined;
  if (!project) return null;
  return {
    id: project.id,
    title: project.title || "Untitled",
    section,
    library: services.library.getLibraryTree(project.id) ?? [],
    activePageId: first === "pages" && id ? id : null,
  };
}

export function shellView(services: AppServices, pathname: string): ShellView {
  return {
    projects: services.projects.list().map((p) => ({ id: p.id, title: p.title || "Untitled" })),
    current: currentProject(services, pathname),
    pages: workspacePageTree(services),
    notifications: notificationsView(services),
  };
}
