import { batchStaysWithin } from "../blocks/batch-scope";
import type { Batch, BlockType, Operation, TreeNode } from "../blocks/types";
import type { ProtectionHook } from "../blocks/validate";
import { TaskError } from "../tasks/errors";
import type { Actor } from "../tasks/types";
import { HUMAN } from "../tasks/types";
import type { Repositories, UnitOfWork } from "../unit-of-work";
import type { Comment, CommentBlockInput, CommentKind } from "./types";
import { COMMENT_OWNER_KIND } from "./types";

/** Comment bodies change only through the comment service. */
export const commentProtection: ProtectionHook = () => "Comments can only be changed through the comment service";

const BYPASS = { bypassProtectionFor: [COMMENT_OWNER_KIND] } as const;

/** Block types a comment body cannot contain. */
const FORBIDDEN: readonly BlockType[] = ["page", "comment"];

/** Which task kinds take which records: comments discuss work and chores, findings record an exploration's results. */
const TASK_KINDS_FOR: Record<CommentKind, readonly string[]> = { comment: ["work", "chore"], finding: ["exploration"] };

export type AddCommentInput = {
  id: string;
  taskId: string;
  /** `comment` by default. */
  kind?: CommentKind;
  author?: Actor;
  blocks: CommentBlockInput[];
};

const fail = (code: TaskError["code"], message: string): never => {
  throw new TaskError(code, message);
};

/** Turns a block tree into insert operations, each child after its previous sibling. */
function insertOps(parentId: string, blocks: readonly CommentBlockInput[]): Operation[] {
  const ops: Operation[] = [];
  let afterId: string | null = null;
  for (const { children, ...block } of blocks) {
    if (FORBIDDEN.includes(block.type)) fail("validation", `A comment cannot contain a ${block.type} block`);
    ops.push({ op: "insert", block, parentId, afterId });
    if (children) ops.push(...insertOps(block.id, children));
    afterId = block.id;
  }
  return ops;
}

function treeIds(tree: TreeNode | undefined): Set<string> {
  const ids = new Set<string>();
  const visit = (node: TreeNode) => {
    ids.add(node.block.id);
    node.children?.forEach(visit);
  };
  if (tree) visit(tree);
  return ids;
}

export class CommentService {
  constructor(
    private readonly uow: UnitOfWork,
    private readonly newId: () => string = () => crypto.randomUUID(),
    private readonly now: () => string = () => new Date().toISOString(),
  ) {}

  add(input: AddCommentInput): Comment {
    return this.uow.run((repos) => this.addWithin(repos, input, this.now()));
  }

  /** Creates a comment and its body inside an existing unit of work (used by `return`). */
  addWithin(repos: Repositories, { id, taskId, kind = "comment", author = HUMAN, blocks }: AddCommentInput, at: string): Comment {
    if (!id) fail("validation", "A comment needs an ID");
    if (repos.comments.get(id)) fail("duplicate_id", `Comment ${id} already exists`);
    const task = repos.tasks.get(taskId) ?? fail("not_found", `Task ${taskId} does not exist`);
    if (!TASK_KINDS_FOR[kind].includes(task.kind)) {
      fail(
        "validation",
        kind === "finding" ? "Only explorations have findings" : `A ${task.kind} is a document itself and cannot have comments`,
      );
    }
    if (author.kind === "agent" && !author.name) fail("validation", "An agent author needs a name");

    const comment: Comment = { id, taskId, kind, bodyBlockId: this.newId(), author, createdAt: at, editedAt: null };
    repos.blocks.apply(
      [
        { op: "insert", block: { id: comment.bodyBlockId, type: "comment" }, owner: { kind: COMMENT_OWNER_KIND, id } },
        ...insertOps(comment.bodyBlockId, blocks),
      ],
      BYPASS,
    );
    repos.comments.insert(comment);
    return comment;
  }

  get(id: string): Comment | undefined {
    return this.uow.repositories.comments.get(id);
  }

  /** A task's comments (or findings, with `kind`), oldest first. */
  list(taskId: string, kind: CommentKind = "comment"): Comment[] {
    return this.uow.repositories.comments.listByTask(taskId, kind);
  }

  /** The comment's body as a tree; its children are the content. */
  body(id: string): TreeNode | undefined {
    const comment = this.get(id);
    return comment && this.uow.repositories.blocks.loadTree(comment.bodyBlockId);
  }

  /** Applies a batch that may only touch this comment's body, and marks the comment edited. */
  edit(id: string, batch: Batch): Comment {
    return this.uow.run((repos) => {
      const comment = repos.comments.get(id) ?? fail("not_found", `Comment ${id} does not exist`);
      const ids = treeIds(repos.blocks.loadTree(comment.bodyBlockId));
      ids.delete(comment.bodyBlockId);
      // The root itself may receive new children but cannot be changed or deleted.
      const inside = batchStaysWithin(new Set([...ids, comment.bodyBlockId]), batch);
      const touchesRoot = batch.some((op) => op.op !== "insert" && op.id === comment.bodyBlockId);
      if (!inside || touchesRoot) fail("validation", "An edit may only change blocks inside the comment");
      for (const op of batch) {
        const type = op.op === "insert" ? op.block.type : op.op === "update" ? op.type : undefined;
        if (type && FORBIDDEN.includes(type)) fail("validation", `A comment cannot contain a ${type} block`);
      }

      repos.blocks.apply(batch, BYPASS);
      const editedAt = this.now();
      repos.comments.setEdited(id, editedAt);
      return { ...comment, editedAt };
    });
  }

  /** Replaces the whole content of a comment (or finding) with `blocks`, and marks it edited. */
  replace(id: string, blocks: CommentBlockInput[]): Comment {
    return this.uow.run((repos) => {
      const comment = repos.comments.get(id) ?? fail("not_found", `Comment ${id} does not exist`);
      const children = repos.blocks.loadTree(comment.bodyBlockId)?.children ?? [];
      repos.blocks.apply(
        [...children.map((child): Operation => ({ op: "delete", id: child.block.id })), ...insertOps(comment.bodyBlockId, blocks)],
        BYPASS,
      );
      const editedAt = this.now();
      repos.comments.setEdited(id, editedAt);
      return { ...comment, editedAt };
    });
  }

  /** Removes the comment and its whole body. Anything pointing at them resolves as missing. */
  delete(id: string): void {
    this.uow.run((repos) => {
      const comment = repos.comments.get(id) ?? fail("not_found", `Comment ${id} does not exist`);
      repos.blocks.apply([{ op: "delete", id: comment.bodyBlockId }], BYPASS);
      repos.comments.delete(id);
    });
  }

  /** Short text for a comment: its first block's text. */
  summary(id: string): { title: string } | undefined {
    const first = this.body(id)?.children?.[0];
    if (!this.get(id)) return undefined;
    return { title: first?.block.content.map((span) => span.text).join("") ?? "" };
  }
}
