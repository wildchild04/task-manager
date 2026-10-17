import type { Block } from "./types";

export type ReferenceResolution =
  | { status: "ok"; target: Block }
  | { status: "missing"; targetId: string }
  | { status: "cycle"; targetId: string };

type GetBlock = (id: string) => Block | undefined;

function ancestorIds(block: Block, getBlock: GetBlock): Set<string> {
  const ids = new Set<string>();
  let parentId = block.parentId;
  while (parentId !== null && !ids.has(parentId)) {
    ids.add(parentId);
    parentId = getBlock(parentId)?.parentId ?? null;
  }
  return ids;
}

/**
 * Resolves a reference block. `expansionPath` holds the block IDs already being
 * expanded above it: its ancestors and the targets of enclosing references.
 * Expanding a target that is on that path, or that contains the reference,
 * would recurse forever, so it resolves as a cycle.
 */
export function resolveReference(
  reference: Block,
  expansionPath: readonly string[],
  getBlock: GetBlock,
): ReferenceResolution {
  if (reference.type !== "reference") throw new Error(`Block ${reference.id} is not a reference`);
  const { targetId } = reference.props;

  if (targetId === reference.id || expansionPath.includes(targetId)) return { status: "cycle", targetId };
  if (ancestorIds(reference, getBlock).has(targetId)) return { status: "cycle", targetId };

  const target = getBlock(targetId);
  return target ? { status: "ok", target } : { status: "missing", targetId };
}
