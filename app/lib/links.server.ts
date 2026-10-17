import type { AppServices } from "~/composition";
import { COMMENT_OWNER_KIND } from "~/domain/comments/types";
import { TASK_OWNER_KIND } from "~/domain/tasks/types";
import type { ResolvedEntity } from "~/domain/tasks/types";

export const commentHref = (taskId: string, commentId: string) => `/tasks/${taskId}#comment-${commentId}`;

/** Where a block is shown: its task page (body or comment), or the nearest page that contains it. */
function blockHref(services: AppServices, blockId: string): string | undefined {
  const owner = services.blocks.rootOf(blockId)?.owner;
  if (owner?.kind === TASK_OWNER_KIND) return `/tasks/${owner.id}`;
  if (owner?.kind === COMMENT_OWNER_KIND) {
    const comment = services.comments.get(owner.id);
    return comment && commentHref(comment.taskId, comment.id);
  }
  let block = services.blocks.getBlock(blockId);
  while (block && block.type !== "page") block = block.parentId ? services.blocks.getBlock(block.parentId) : undefined;
  return block && `/pages/${block.id}`;
}

export type TargetLink = { status: "ok"; kind: string; title: string; href?: string } | { status: "missing"; kind: string };

/** A resolved relation target as a link for the task page. */
export function targetLink(services: AppServices, target: ResolvedEntity): TargetLink {
  if (target.status === "missing") return { status: "missing", kind: target.kind };
  let href: string | undefined;
  if (target.kind === "task") href = `/tasks/${target.id}`;
  else if (target.kind === "comment") {
    const comment = services.comments.get(target.id);
    href = comment && commentHref(comment.taskId, comment.id);
  } else if (target.kind === "block") href = blockHref(services, target.id);
  return { status: "ok", kind: target.kind, title: target.title || "Untitled", ...(href ? { href } : {}) };
}
