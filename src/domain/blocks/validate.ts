import { BlockOperationError } from "./errors";
import { parseContent, parseProps, parseType } from "./schema";
import type { Block, BlockType, Operation, Owner, RichText } from "./types";
import { isLeafType, isRootType, isTextType } from "./types";

/** Read-only view of the current state, including earlier operations of the batch. */
export interface BlockReader {
  getBlock(id: string): Block | undefined;
}

/**
 * What a protection hook is asked about: an operation that touches the tree of
 * an owned root. `targetIsRoot` is true when the operation acts on the owned
 * root itself rather than on a block inside its tree.
 */
export type ProtectionContext = {
  op: Operation;
  owner: Owner;
  rootId: string;
  targetIsRoot: boolean;
};

/** Returns a reason to reject the operation, or `undefined` to allow it. */
export type ProtectionHook = (context: ProtectionContext) => string | undefined;

/** Protection hooks keyed by owner kind, registered by the owning domains. */
export type ProtectionHooks = Readonly<Record<string, ProtectionHook>>;

export type ValidationOptions = {
  hooks?: ProtectionHooks;
  /** Owner kinds whose protection is skipped, for the owning domain's own service. */
  bypassProtectionFor?: readonly string[];
};

/** A validated operation with parsed props and content, ready to apply. */
export type ValidatedOperation =
  | {
      kind: "insert";
      id: string;
      type: BlockType;
      props: Record<string, unknown>;
      content: RichText;
      targetId: string | null;
      parentId: string | null;
      owner: Owner | null;
      afterId: string | null;
    }
  | {
      kind: "update";
      id: string;
      type: BlockType;
      props: Record<string, unknown>;
      content: RichText;
      targetId: string | null;
    }
  | { kind: "move"; id: string; parentId: string | null; afterId: string | null }
  | { kind: "delete"; id: string };

function fail(code: BlockOperationError["code"], message: string): never {
  throw new BlockOperationError(code, message);
}

function mustGet(reader: BlockReader, id: string, what: string): Block {
  const block = reader.getBlock(id);
  if (!block) fail("not_found", `${what} ${id} does not exist`);
  return block;
}

/** The root of a block's tree. */
function rootOf(reader: BlockReader, block: Block): Block {
  let current = block;
  const seen = new Set<string>();
  while (current.parentId !== null) {
    if (seen.has(current.id)) fail("cycle", `Ownership cycle at ${current.id}`);
    seen.add(current.id);
    current = mustGet(reader, current.parentId, "Parent");
  }
  return current;
}

function isSelfOrDescendant(reader: BlockReader, candidateId: string, ancestorId: string): boolean {
  let current = reader.getBlock(candidateId);
  while (current) {
    if (current.id === ancestorId) return true;
    if (current.parentId === null) return false;
    current = reader.getBlock(current.parentId);
  }
  return false;
}

function targetIdOf(type: BlockType, props: Record<string, unknown>): string | null {
  return type === "reference" ? (props.targetId as string) : null;
}

function isInsideSuggestion(reader: BlockReader, parentId: string | null): boolean {
  for (let at = parentId === null ? undefined : reader.getBlock(parentId); at; ) {
    if (at.type === "suggestion") return true;
    at = at.parentId === null ? undefined : reader.getBlock(at.parentId);
  }
  return false;
}

function checkReferenceTarget(reader: BlockReader, id: string, type: BlockType, props: Record<string, unknown>) {
  if (type !== "reference") return;
  const targetId = props.targetId as string;
  if (targetId === id) fail("validation", "A reference cannot point at itself");
  mustGet(reader, targetId, "Reference target");
}

/**
 * Every mention a write adds must point at an existing page. Mentions the
 * content already had are kept as they are, even if their page was deleted since.
 */
function checkMentionTargets(reader: BlockReader, content: RichText, previous: RichText = []) {
  const kept = new Set(previous.flatMap((span) => (span.mention ? [span.mention.pageId] : [])));
  for (const span of content) {
    if (!span.mention || kept.has(span.mention.pageId)) continue;
    const target = reader.getBlock(span.mention.pageId);
    if (target?.type !== "page") fail("validation", `Mention target ${span.mention.pageId} is not a page`);
  }
}

/** Checks that `type` may be placed under `parentId`, after `afterId`. */
function checkPlacement(
  reader: BlockReader,
  type: BlockType,
  parentId: string | null,
  afterId: string | null,
  movingId?: string,
) {
  if (type === "comment") fail("invalid_parent", "A comment block must be an owned root");
  // A suggestion's proposed blocks are plain content: no pages, and no suggestions within suggestions.
  if ((type === "page" || type === "suggestion") && isInsideSuggestion(reader, parentId)) {
    fail("invalid_parent", `A ${type} block can't be inside a suggestion`);
  }
  if (parentId === null) {
    if (type !== "page") fail("invalid_parent", `A ${type} block must have a parent`);
  } else {
    const parent = mustGet(reader, parentId, "Parent");
    if (isLeafType(parent.type)) fail("invalid_parent", `A ${parent.type} block cannot have children`);
    if (movingId !== undefined && isSelfOrDescendant(reader, parentId, movingId)) {
      fail("cycle", "A block cannot be moved into itself or one of its descendants");
    }
  }
  if (afterId !== null) {
    if (afterId === movingId) fail("invalid_position", "A block cannot be placed after itself");
    const after = mustGet(reader, afterId, "Sibling");
    if (after.parentId !== parentId || after.owner !== null) {
      fail("invalid_position", `Block ${afterId} is not a sibling under ${parentId ?? "the workspace root"}`);
    }
  }
}

function checkProtection(reader: BlockReader, op: Operation, block: Block, options: ValidationOptions) {
  const root = rootOf(reader, block);
  if (!root.owner) return;
  const hook = options.hooks?.[root.owner.kind];
  if (!hook || options.bypassProtectionFor?.includes(root.owner.kind)) return;
  const reason = hook({ op, owner: root.owner, rootId: root.id, targetIsRoot: root.id === block.id });
  if (reason) fail("protected", reason);
}

/**
 * Validates one operation against the current state and returns it in
 * normalized form. Throws a `BlockOperationError` when a rule is broken.
 */
export function validateOperation(
  op: Operation,
  reader: BlockReader,
  options: ValidationOptions = {},
): ValidatedOperation {
  switch (op.op) {
    case "insert": {
      const { id } = op.block;
      if (reader.getBlock(id)) fail("duplicate_id", `Block ${id} already exists`);
      const type = parseType(op.block.type);
      const props = parseProps(type, op.block.props);
      const content = parseContent(type, op.block.content);
      checkReferenceTarget(reader, id, type, props);
      checkMentionTargets(reader, content);

      if ("owner" in op) {
        if (!isRootType(type)) fail("invalid_parent", `A ${type} block cannot be an owned root`);
        if (!op.owner.kind || !op.owner.id) fail("validation", "An owner needs a kind and an ID");
        return { kind: "insert", id, type, props, content, targetId: targetIdOf(type, props), parentId: null, owner: op.owner, afterId: null };
      }

      const afterId = op.afterId ?? null;
      checkPlacement(reader, type, op.parentId, afterId);
      if (op.parentId !== null) checkProtection(reader, op, mustGet(reader, op.parentId, "Parent"), options);
      return { kind: "insert", id, type, props, content, targetId: targetIdOf(type, props), parentId: op.parentId, owner: null, afterId };
    }

    case "update": {
      const block = mustGet(reader, op.id, "Block");
      checkProtection(reader, op, block, options);
      const type = op.type === undefined ? block.type : parseType(op.type);

      if (type !== block.type) {
        if (type === "comment" || block.type === "comment") {
          fail("invalid_type_change", "A block cannot be turned into or out of a comment");
        }
        if (type === "suggestion" || block.type === "suggestion") {
          fail("invalid_type_change", "A block cannot be turned into or out of a suggestion");
        }
        if (isTextType(type) !== isTextType(block.type)) {
          fail("invalid_type_change", `A ${block.type} block cannot be turned into a ${type}`);
        }
        if (block.parentId === null && !isRootType(type)) {
          fail("invalid_type_change", `A root ${block.type} cannot be turned into a ${type}`);
        }
      }

      const props = parseProps(type, type === block.type ? { ...block.props, ...op.props } : (op.props ?? {}));
      const content = parseContent(type, op.content ?? block.content);
      if (op.content !== undefined) checkMentionTargets(reader, content, block.content);
      checkReferenceTarget(reader, block.id, type, props);
      return { kind: "update", id: block.id, type, props, content, targetId: targetIdOf(type, props) };
    }

    case "move": {
      const block = mustGet(reader, op.id, "Block");
      if (block.owner) fail("invalid_parent", "An owned root cannot be moved");
      const afterId = op.afterId ?? null;
      checkPlacement(reader, block.type, op.parentId, afterId, block.id);
      checkProtection(reader, op, block, options);
      if (op.parentId !== null) checkProtection(reader, op, mustGet(reader, op.parentId, "Parent"), options);
      return { kind: "move", id: block.id, parentId: op.parentId, afterId };
    }

    case "delete": {
      const block = mustGet(reader, op.id, "Block");
      checkProtection(reader, op, block, options);
      return { kind: "delete", id: block.id };
    }
  }
}
