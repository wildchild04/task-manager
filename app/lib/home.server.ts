import type { AppServices } from "~/composition";
import type { TreeNode } from "~/domain/blocks/types";
import { choreAttributes } from "~/domain/chores/schedule";
import type { LibraryNode } from "~/domain/library/library.service";
import type { TaskSummary } from "~/domain/tasks/types";

import { formatDateTime } from "./format";
import { allPages, allTasks, workspacePageTree } from "./page-search.server";

/** Something that needs the human: a task, why, and where it lives. */
export type AttentionItem = {
  id: string;
  title: string;
  href: string;
  project: string;
  reason: string;
  tone: "error" | "warning" | "info";
};

export type ProjectCard = { id: string; title: string; activeWork: number; openIdeas: number; urgentChores: number };

export type RecentItem = { kind: "page" | "task"; id: string; title: string; place: string; href: string; edited: string };

/** A page or task with agents' suggestions waiting for review. */
export type ReviewItem = { id: string; title: string; place: string; href: string; count: number; agents: string[] };

export type HomeView = {
  review: ReviewItem[];
  attention: { items: AttentionItem[]; more: number };
  projects: ProjectCard[];
  pages: LibraryNode[];
  recent: RecentItem[];
};

const ATTENTION_LIMIT = 10;
const RECENT_LIMIT = 8;

/** The latest change among a tree's blocks (its title and content; sub-pages are separate trees). */
function lastEdit(tree: TreeNode | undefined): string {
  let latest = "";
  const visit = (node: TreeNode) => {
    if (node.block.updatedAt > latest) latest = node.block.updatedAt;
    node.children?.forEach(visit);
  };
  if (tree) visit(tree);
  return latest;
}

/** "just now", "5 min ago", "2 h ago", "3 d ago", or the date beyond a week. */
export function relativeTime(iso: string, now: string, timeZone: string): string {
  const minutes = Math.floor((Date.parse(now) - Date.parse(iso)) / 60000);
  if (minutes < 1) return "just now";
  if (minutes < 60) return `${minutes} min ago`;
  if (minutes < 60 * 24) return `${Math.floor(minutes / 60)} h ago`;
  if (minutes < 60 * 24 * 7) return `${Math.floor(minutes / (60 * 24))} d ago`;
  return formatDateTime(iso, timeZone);
}

/** The agent who did the task's latest `name` transition, if an agent did it. */
function lastAgent(services: AppServices, task: TaskSummary, name: string): string | undefined {
  const record = services.tasks
    .history(task.id)
    .filter((r) => r.name === name)
    .at(-1);
  return record?.actor.kind === "agent" ? record.actor.name : undefined;
}

/** What needs or involves the human, by kind: urgent and overdue chores (most pressing first), returned work, work in progress. */
function attentionGroups(services: AppServices, now: string) {
  const timeZone = services.tasks.timeZone;
  const urgent: (AttentionItem & { overdue: boolean; due: number })[] = [];
  const returned: AttentionItem[] = [];
  const inProgress: (AttentionItem & { updated: string })[] = [];

  for (const project of services.projects.list()) {
    const projectTitle = project.title || "Untitled";
    for (const task of services.tasks.list(project.id)) {
      const base = { id: task.id, title: task.title || "Untitled", href: `/tasks/${task.id}`, project: projectTitle };
      if (task.kind === "chore" && task.state === "todo" && services.chores.isUrgent(task, now)) {
        const { dueAt } = choreAttributes(task);
        const overdue = dueAt !== undefined && Date.parse(dueAt) <= Date.parse(now);
        const due = dueAt ? ` · due ${formatDateTime(dueAt, timeZone)}` : "";
        urgent.push({
          ...base,
          reason: `${overdue ? "Overdue" : "Urgent"}${due}`,
          tone: "error",
          overdue,
          due: dueAt ? Date.parse(dueAt) : Infinity,
        });
      } else if (task.kind === "work" && task.state === "todo") {
        const history = services.tasks.history(task.id);
        const last = history.at(-1);
        if (last?.name === "return" && last.actor.kind === "agent")
          returned.push({ ...base, reason: `Returned by ${last.actor.name}`, tone: "warning" });
      } else if (task.kind === "work" && task.state === "in_progress") {
        const agent = lastAgent(services, task, "start");
        inProgress.push({
          ...base,
          reason: agent ? `In progress · ${agent}` : "In progress",
          tone: "info",
          updated: task.updatedAt,
        });
      }
    }
  }

  urgent.sort((a, b) => Number(b.overdue) - Number(a.overdue) || a.due - b.due);
  inProgress.sort((a, b) => b.updated.localeCompare(a.updated));
  return {
    urgent: urgent.map(({ overdue: _o, due: _d, ...item }): AttentionItem => item),
    returned,
    inProgress: inProgress.map(({ updated: _u, ...item }): AttentionItem => item),
  };
}

function attention(services: AppServices, now: string): HomeView["attention"] {
  const { urgent, returned, inProgress } = attentionGroups(services, now);
  const all = [...urgent, ...returned, ...inProgress];
  return { items: all.slice(0, ATTENTION_LIMIT), more: Math.max(0, all.length - ATTENTION_LIMIT) };
}

function projectCards(services: AppServices, now: string): ProjectCard[] {
  return services.projects.list().map((project) => {
    const tasks = services.tasks.list(project.id);
    return {
      id: project.id,
      title: project.title || "Untitled",
      activeWork: tasks.filter((t) => t.kind === "work" && (t.state === "todo" || t.state === "in_progress")).length,
      openIdeas: tasks.filter((t) => (t.kind === "exploration" || t.kind === "update") && t.state === "open").length,
      urgentChores: tasks.filter((t) => t.kind === "chore" && t.state === "todo" && services.chores.isUrgent(t, now)).length,
    };
  });
}

/** Library documents, workspace pages and tasks, most recently edited first. */
function recent(services: AppServices, now: string): RecentItem[] {
  const timeZone = services.tasks.timeZone;
  const items = [
    ...allPages(services).map((page) => ({ kind: "page" as const, ...page, at: lastEdit(services.blocks.loadTree(page.id)) })),
    ...allTasks(services).map((task) => {
      const updated = services.tasks.get(task.href.slice("/tasks/".length))?.updatedAt ?? "";
      const body = lastEdit(services.blocks.loadTree(task.id));
      return { kind: "task" as const, ...task, at: body > updated ? body : updated };
    }),
  ];
  return items
    .sort((a, b) => b.at.localeCompare(a.at))
    .slice(0, RECENT_LIMIT)
    .map(({ kind, id, title, place, href, at }) => ({ kind, id, title, place, href, edited: relativeTime(at, now, timeZone) }));
}

/** Pages and tasks with pending suggestions, the one with the oldest first, with how many and from which agents. */
function review(services: AppServices): ReviewItem[] {
  const places = new Map([...allPages(services), ...allTasks(services)].map((place) => [place.id, place]));
  const items = new Map<string, ReviewItem>();
  for (const suggestion of services.suggestions.listPending()) {
    const place = places.get(suggestion.pageId);
    if (!place) continue;
    const item = items.get(place.id) ?? {
      id: place.id,
      title: place.title,
      place: place.place,
      href: place.href,
      count: 0,
      agents: [],
    };
    item.count += 1;
    if (!item.agents.includes(suggestion.author)) item.agents.push(suggestion.author);
    items.set(place.id, item);
  }
  return [...items.values()];
}

/** The home dashboard: what needs attention across projects, the projects, the workspace pages, and recent edits. */
export function homeView(services: AppServices, now: string = new Date().toISOString()): HomeView {
  return {
    review: review(services),
    attention: attention(services, now),
    projects: projectCards(services, now),
    pages: workspacePageTree(services),
    recent: recent(services, now),
  };
}

/** One place that needs the human, for the notification bell: its title, why, and where it opens. */
export type NotificationItem = { id: string; title: string; detail: string; href: string };

const plural = (n: number, one: string) => `${n} ${one}${n === 1 ? "" : "s"}`;

/**
 * What waits for the human, as the bell lists it: suggestions to review
 * (oldest first), then overdue and urgent chores, then work returned by an
 * agent. The same builders as the home dashboard, without work in progress.
 */
export function notificationsView(services: AppServices, now: string = new Date().toISOString()): NotificationItem[] {
  const { urgent, returned } = attentionGroups(services, now);
  return [
    ...review(services).map((item) => ({
      id: item.id,
      title: item.title,
      detail: `${plural(item.count, "suggestion")} · ${item.agents.join(", ")}`,
      href: item.href,
    })),
    ...[...urgent, ...returned].map((item) => ({ id: item.id, title: item.title, detail: item.reason, href: item.href })),
  ];
}
