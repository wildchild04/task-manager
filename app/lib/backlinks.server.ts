import type { AppServices } from "~/composition";
import { plainText } from "~/domain/blocks/text";
import type { Block } from "~/domain/blocks/types";
import { TASK_OWNER_KIND } from "~/domain/tasks/types";

import { slugOfKind, TASK_LISTS } from "./format";
import { browsableScope } from "./page-view.server";

/** A place that mentions or references a page: another page, or a task through its description. */
type Place =
  | { kind: "page"; id: string; title: string; href: string }
  | { kind: "task"; id: string; title: string; href: string; taskKind: string };

export type Backlink = Place & { count: number };

/** Where a block lives: the task whose description holds it, or the nearest browsable page; nothing for comments. */
function placeOf(services: AppServices, block: Block): Place | undefined {
  const owner = services.blocks.rootOf(block.id)?.owner;
  if (owner?.kind === TASK_OWNER_KIND) {
    const task = services.tasks.get(owner.id);
    return (
      task && {
        kind: "task",
        id: task.id,
        title: task.title || "Untitled",
        href: `/tasks/${task.id}`,
        taskKind: TASK_LISTS[slugOfKind(task.kind)].singular,
      }
    );
  }
  let page: Block | undefined = block;
  while (page && page.type !== "page") page = page.parentId ? services.blocks.getBlock(page.parentId) : undefined;
  if (!page || !browsableScope(services.blocks, page)) return undefined;
  return { kind: "page", id: page.id, title: plainText(page.content) || "Untitled", href: `/pages/${page.id}` };
}

/**
 * The places that mention a page inline or reference it with a reference
 * block, one entry per place with how many times it does. The page itself is
 * left out. Pages come first, then tasks, each by title.
 */
export function pageBacklinks(services: AppServices, pageId: string): Backlink[] {
  const sources = [...services.blocks.listMentioning(pageId), ...services.blocks.listIncomingReferences(pageId)];
  const places = new Map<string, Backlink>();
  for (const block of sources) {
    const place = placeOf(services, block);
    if (!place || (place.kind === "page" && place.id === pageId)) continue;
    // A block may mention the page several times; each one counts.
    const times = block.type === "reference" ? 1 : block.content.filter((span) => span.mention?.pageId === pageId).length;
    const key = `${place.kind}:${place.id}`;
    const existing = places.get(key);
    places.set(key, { ...place, count: (existing?.count ?? 0) + times });
  }
  return [...places.values()].sort((a, b) => (a.kind === b.kind ? a.title.localeCompare(b.title) : a.kind === "page" ? -1 : 1));
}
