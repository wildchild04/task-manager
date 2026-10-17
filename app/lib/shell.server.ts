import type { AppServices } from "~/composition";
import { plainText } from "~/domain/blocks/text";

import { isTaskListSlug, slugOfKind, type TaskListSlug } from "./format";

export type ProjectSection = "home" | TaskListSlug | "library";

export type ShellView = {
  projects: { id: string; title: string }[];
  /** The project being viewed (directly, or through one of its tasks or pages) and its current section. */
  current: { id: string; title: string; section: ProjectSection } | null;
  pages: { id: string; title: string }[];
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
  return project ? { id: project.id, title: project.title || "Untitled", section } : null;
}

export function shellView(services: AppServices, pathname: string): ShellView {
  return {
    projects: services.projects.list().map((p) => ({ id: p.id, title: p.title || "Untitled" })),
    current: currentProject(services, pathname),
    pages: services.blocks.listRootPages().map((page) => ({ id: page.id, title: plainText(page.content) || "Untitled" })),
  };
}
