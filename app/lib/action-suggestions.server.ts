import type { AppServices } from "~/composition";
import type { ActionKind, ActionSuggestion, Subject } from "~/domain/suggestions/types";

import { describeSchedule, slugOfKind, TASK_LISTS } from "./format";
import { pageDeletion } from "./page-edit.server";

/** A pending action suggestion as its bar shows it: "<author> suggests <words>". */
export type ActionSuggestionItem = {
  id: string;
  author: string;
  action: ActionKind;
  /** What it proposes, in words: `renaming to "Roadmap 2027"`, "deleting this page", … */
  words: string;
  note: string | null;
  outdated: boolean;
};

/** "this project", "this page", "this exploration", … */
function subjectNoun(services: AppServices, subject: Subject): string {
  if (subject.kind !== "task") return `this ${subject.kind}`;
  const task = services.tasks.get(subject.id);
  return task ? `this ${TASK_LISTS[slugOfKind(task.kind)].singular}` : "this task";
}

/** What an action suggestion proposes, in words, after "suggests". */
export function actionWords(services: AppServices, suggestion: ActionSuggestion): string {
  const { payload } = suggestion;
  const noun = subjectNoun(services, suggestion.subject);
  switch (payload.action) {
    case "rename":
      return `renaming ${noun} to "${payload.title}"`;
    case "delete":
      return `deleting ${noun}`;
    case "schedule":
      return payload.schedule
        ? `changing the schedule to ${describeSchedule(payload.schedule)}`
        : "removing the schedule";
    case "transition":
      if (payload.scope === "series") return "ending this chore's series";
      return `${payload.name === "cancel" ? "cancelling" : "tombstoning"} ${noun}`;
  }
}

/** The pending action suggestions shown on a place page (a project's home page, a page, a task's body page), oldest first. */
export function actionSuggestionItems(services: AppServices, placePageId: string): ActionSuggestionItem[] {
  return services.suggestions.pendingActions(placePageId).map((s) => ({
    id: s.id,
    author: s.author,
    action: s.action,
    words: actionWords(services, s),
    note: s.note,
    outdated: s.state === "outdated",
  }));
}

/** Where the browser goes once an approved deletion removed the subject, as the delete button would; work out before approving. */
export function deletionRedirect(services: AppServices, subject: Subject): string | undefined {
  switch (subject.kind) {
    case "project":
      return "/";
    case "page":
      return pageDeletion(services, subject.id)?.redirectTo;
    case "task": {
      const task = services.tasks.get(subject.id);
      return task && `/projects/${task.projectId}/${slugOfKind(task.kind)}`;
    }
  }
}
