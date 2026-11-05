import { BatchError } from "../blocks/errors";
import type { Block, BlockType, NewBlock, Operation, SuggestionAction, SuggestionProps, TreeNode } from "../blocks/types";
import { isLeafType } from "../blocks/types";
import type { Schedule } from "../chores/schedule";
import type { Repositories, UnitOfWork } from "../unit-of-work";
import { SuggestionError } from "./errors";
import type { SuggestedActions } from "./suggested-actions";
import type {
  ActionPayload,
  ActionSuggestion,
  BlockSuggestion,
  Subject,
  Suggestion,
  SuggestionBlockInput,
  SuggestionFeedback,
  SuggestionState,
} from "./types";

/** Block types a suggestion can't propose. */
const FORBIDDEN: readonly BlockType[] = ["page", "comment", "suggestion"];

export const NOTE_MAX = 280;
/** The longest feedback the human can give on a suggestion. */
export const FEEDBACK_MAX = 2000;

export type SuggestInput = {
  id?: string;
  /** The page whose own content the suggestion changes. */
  pageId: string;
  action: SuggestionAction;
  /** Insert only: the block to follow, or the block to add under (as its last child). Neither: the end of the page. */
  afterId?: string;
  insideId?: string;
  /** Replace and delete: the block acted on. */
  targetId?: string;
  blocks?: SuggestionBlockInput[];
  note?: string;
  /** The agent making it. */
  author: string;
};

export type SuggestActionInput = {
  id?: string;
  subject: Subject;
  payload: ActionPayload;
  note?: string;
  /** The agent making it. */
  author: string;
};

/** What a suggestion's view adds to its record. */
type ViewFields = {
  /** As reported: `changes_requested` while it has open feedback, else `outdated` when its target or subject changed. */
  state: SuggestionState;
  /** Pending, and its target or subject changed since it was made or last revised: it can't be approved. */
  outdated: boolean;
  /** The human's open feedback (given on the current revision), oldest first; empty unless pending. */
  feedback: SuggestionFeedback[];
  /** After a revision with no feedback since: the latest feedback it answered. */
  answered: SuggestionFeedback | null;
};
export type SuggestionView = Suggestion & ViewFields;
export type ActionSuggestionView = ActionSuggestion & ViewFields;

export type ReviseInput = {
  id: string;
  /** The agent revising; only the suggestion's author can. */
  author: string;
  /** A block insert or replace: the new proposed blocks. */
  blocks?: SuggestionBlockInput[];
  /** A rename: the new title. */
  title?: string;
  /** A schedule suggestion: the new schedule, or `null` to remove it. */
  schedule?: Schedule | null;
  /** The agent's new note (its reply); `""` clears it, omitted keeps it. */
  note?: string;
};

const fail = (code: SuggestionError["code"], message: string): never => {
  throw new SuggestionError(code, message);
};

/** JSON with sorted keys, so equal values always compare equal. */
function stable(value: unknown): string {
  return JSON.stringify(value, (_key, v: unknown) =>
    v && typeof v === "object" && !Array.isArray(v)
      ? Object.fromEntries(Object.entries(v).sort(([a], [b]) => a.localeCompare(b)))
      : v,
  );
}

const own = (block: Block) => ({ type: block.type, props: block.props, content: block.content });
const subtree = (node: TreeNode): unknown => ({ ...own(node.block), children: (node.children ?? []).map(subtree) });
/** A block and its descendants, stopping at nested pages (whose content is their own). */
function treeOf(repos: Repositories, block: Block): TreeNode {
  if (block.type === "page") return { block, children: null };
  return { block, children: repos.blocks.getChildren(block.id).map((child) => treeOf(repos, child)) };
}

const asNew = (block: Block): NewBlock => ({ id: block.id, type: block.type, props: block.props, content: block.content });

/** Whether blocks can be nested under a block of this type (a table holds only its rows). */
const holdsChildren = (type: BlockType) => !isLeafType(type) && type !== "page" && type !== "suggestion" && type !== "table";

/** A delete, or a replace of a table, acts on the target and everything in it; other replaces on the block alone. */
const actsOnSubtree = (action: SuggestionAction, target: Block) => action === "delete" || target.type === "table";

/** Insert operations for a tree of new blocks under `parentId`, the first after `afterId`. */
function insertOps(parentId: string, afterId: string | null, blocks: readonly SuggestionBlockInput[]): Operation[] {
  const ops: Operation[] = [];
  let previous = afterId;
  for (const { children, ...block } of blocks) {
    if (FORBIDDEN.includes(block.type)) fail("validation", `A suggestion can't propose a ${block.type} block`);
    ops.push({ op: "insert", block, parentId, afterId: previous });
    if (children?.length) ops.push(...insertOps(block.id, null, children));
    previous = block.id;
  }
  return ops;
}

/** Insert operations that put back an existing subtree. */
function restoreOps(node: TreeNode, parentId: string, afterId: string | null): Operation[] {
  const ops: Operation[] = [{ op: "insert", block: asNew(node.block), parentId, afterId }];
  let previous: string | null = null;
  for (const child of node.children ?? []) {
    ops.push(...restoreOps(child, node.block.id, previous));
    previous = child.block.id;
  }
  return ops;
}

/** Moves of `ids`, in order, under `parentId` starting after `afterId`. */
function moveOps(ids: readonly string[], parentId: string, afterId: string | null): Operation[] {
  return ids.map((id, i) => ({ op: "move", id, parentId, afterId: i === 0 ? afterId : ids[i - 1]! }));
}

/** Puts back two sibling-level inserts so that one placed after the other comes second. */
function inOrder(a: Operation[], aId: string, b: Operation[], bId: string): Operation[] {
  const after = (ops: Operation[]) => {
    const first = ops[0]!;
    return first.op === "insert" && "afterId" in first ? first.afterId : null;
  };
  return after(a) === bId ? [...b, ...a] : after(b) === aId ? [...a, ...b] : [...a, ...b];
}

/**
 * Agents' proposed changes to a page's own content. Only the service changes
 * suggestion blocks; humans approve or reject, agents suggest and withdraw.
 */
export class SuggestionService {
  constructor(
    private readonly uow: UnitOfWork,
    private readonly newId: () => string = () => crypto.randomUUID(),
    private readonly now: () => string = () => new Date().toISOString(),
    private readonly actions?: SuggestedActions,
  ) {}

  private get suggested(): SuggestedActions {
    return this.actions ?? fail("validation", "Actions can't be suggested here");
  }

  /** Records an agent's proposal to act on a project, page or task, checked as if it were applied now. */
  suggestAction(input: SuggestActionInput): SuggestionView {
    return this.uow.run((repos) => {
      const { subject, payload, author } = input;
      if (!author) fail("validation", "A suggestion needs the agent making it");
      if (input.note && input.note.length > NOTE_MAX) fail("validation", `A note is at most ${NOTE_MAX} characters`);
      const pageId = this.suggested.placeOf(subject) ?? fail("not_found", `The ${subject.kind} ${subject.id} does not exist`);
      this.suggested.check(subject, payload);
      const suggestion: ActionSuggestion = {
        id: input.id ?? this.newId(),
        pageId,
        subject,
        action: payload.action,
        payload: payload.action === "rename" ? { ...payload, title: payload.title.trim() } : payload,
        targetId: null,
        note: input.note || null,
        author,
        base: this.suggested.baseOf(subject, payload)!,
        status: "pending",
        undo: null,
        createdAt: this.now(),
        resolvedAt: null,
        revision: 1,
        revisedAt: null,
      };
      repos.suggestions.insert(suggestion);
      return this.view(repos, suggestion);
    });
  }

  /** Pending action suggestions whose subject shows on this place page and still exists, oldest first. */
  pendingActions(pageId: string): ActionSuggestionView[] {
    return this.listPending().filter((s): s is ActionSuggestionView => s.subject !== null && s.pageId === pageId);
  }

  suggest(input: SuggestInput): SuggestionView {
    return this.uow.run((repos) => {
      const { pageId, action, author } = input;
      const blocks = input.blocks ?? [];
      if (!author) fail("validation", "A suggestion needs the agent making it");
      if (input.note && input.note.length > NOTE_MAX) fail("validation", `A note is at most ${NOTE_MAX} characters`);
      const page = repos.blocks.getBlock(pageId) ?? fail("not_found", `Page ${pageId} does not exist`);
      if (page.type !== "page") fail("not_found", `Page ${pageId} does not exist`);
      const content = this.ownContent(repos, pageId);
      const inPage = (id: string, what: string): Block => {
        const block = content.blocks.get(id) ?? fail("not_found", `${what} ${id} is not in this page`);
        if (content.inSuggestion.has(id)) fail("validation", `${what} ${id} is inside a suggestion`);
        if (block.type === "table_row" || block.type === "table_cell") {
          let table: Block = block;
          while (table.type !== "table") table = content.blocks.get(table.parentId!)!;
          fail("validation", `${what} ${id} is part of a table; suggest on the whole table (${table.id}) instead`);
        }
        return block;
      };

      let parentId: string;
      let afterId: string | null;
      let targetId: string | null = null;
      let base: string | null = null;
      if (action === "insert") {
        if (input.targetId) fail("validation", "An insert has no target");
        if (input.afterId && input.insideId) fail("validation", "Give `after` or `inside`, not both");
        if (blocks.length === 0) fail("validation", "An insert needs the blocks to add");
        if (input.afterId) {
          const after = inPage(input.afterId, "Block");
          parentId = after.parentId!;
          afterId = after.id;
        } else {
          const inside = input.insideId ? inPage(input.insideId, "Block") : page;
          if (inside.type === "table")
            fail("validation", "Nothing can be added inside a table; suggest replacing the whole table");
          if (inside.id !== pageId && !holdsChildren(inside.type))
            fail("validation", `A ${inside.type} can't hold the suggested blocks`);
          parentId = inside.id;
          afterId = repos.blocks.getChildren(inside.id).at(-1)?.id ?? null;
        }
      } else {
        if (!input.targetId) fail("validation", `A ${action} needs a target`);
        if (input.afterId || input.insideId) fail("validation", `A ${action} goes right after its target`);
        if (action === "replace" && blocks.length === 0) fail("validation", "A replace needs the blocks to put in");
        if (action === "delete" && blocks.length > 0) fail("validation", "A delete proposes no blocks");
        const target = inPage(input.targetId!, "Target");
        if (target.type === "page" || target.type === "suggestion") fail("validation", `A ${target.type} can't be ${action}d`);
        const tree = treeOf(repos, target);
        if (action === "delete" && JSON.stringify(subtree(tree)).includes('"type":"page"')) {
          fail("validation", "A delete can't remove a page");
        }
        parentId = target.parentId!;
        afterId = target.id;
        targetId = target.id;
        base = stable(actsOnSubtree(action, target) ? subtree(tree) : own(target));
      }

      const id = input.id ?? this.newId();
      const props: SuggestionProps = targetId ? { action: action as "replace" | "delete", targetId } : { action: "insert" };
      this.apply(repos, [
        { op: "insert", block: { id, type: "suggestion", props }, parentId, afterId },
        ...insertOps(id, null, blocks),
      ]);
      const suggestion: BlockSuggestion = {
        id,
        pageId,
        subject: null,
        action,
        targetId,
        note: input.note || null,
        author,
        base,
        status: "pending",
        undo: null,
        createdAt: this.now(),
        resolvedAt: null,
        revision: 1,
        revisedAt: null,
      };
      repos.suggestions.insert(suggestion);
      return this.view(repos, suggestion);
    });
  }

  get(id: string): SuggestionView | undefined {
    const suggestion = this.uow.repositories.suggestions.get(id);
    return suggestion && this.view(this.uow.repositories, suggestion);
  }

  /** The IDs of suggestions starting with `prefix`. */
  idsStartingWith(prefix: string): string[] {
    return this.uow.repositories.suggestions.findByPrefix(prefix).map((s) => s.id);
  }

  /** Pending suggestions still on their page (an action's: whose subject still exists), oldest first. */
  listPending(): SuggestionView[] {
    const repos = this.uow.repositories;
    return repos.suggestions
      .listPending()
      .filter((s) => (s.subject ? this.actions?.placeOf(s.subject) : repos.blocks.getBlock(s.id)))
      .map((s) => this.view(repos, s));
  }

  /** A page's pending suggestions, in document order. */
  pendingOn(pageId: string): SuggestionView[] {
    const repos = this.uow.repositories;
    return this.idsInOrder(repos, pageId).map((id) => this.view(repos, repos.suggestions.get(id)!));
  }

  approve(id: string): SuggestionView {
    return this.uow.run((repos) => this.approveWithin(repos, id));
  }

  reject(id: string): SuggestionView {
    return this.uow.run((repos) => this.rejectWithin(repos, id));
  }

  /** The author takes back its own pending suggestion. */
  withdraw(id: string, author: string): SuggestionView {
    return this.uow.run((repos) => {
      const suggestion = this.pending(repos, id);
      if (suggestion.author !== author) fail("forbidden", `Only ${suggestion.author}, who made it, can withdraw this suggestion`);
      if (!suggestion.subject) this.apply(repos, [{ op: "delete", id }]);
      return this.resolve(repos, suggestion, "withdrawn", null);
    });
  }

  /** The human asks the suggestion's agent for changes; nothing else changes. */
  requestChanges(id: string, text: string): SuggestionView {
    return this.uow.run((repos) => {
      const suggestion = this.pending(repos, id);
      const trimmed = text.trim();
      if (!trimmed) fail("validation", "Say what should change");
      if (trimmed.length > FEEDBACK_MAX) fail("validation", `Feedback is at most ${FEEDBACK_MAX} characters`);
      repos.suggestions.addFeedback({
        id: this.newId(),
        suggestionId: suggestion.id,
        text: trimmed,
        revision: suggestion.revision,
        createdAt: this.now(),
      });
      return this.view(repos, suggestion);
    });
  }

  /**
   * The author changes its own pending suggestion in place: new proposed blocks, a new title or schedule, a new
   * note. It's checked against its target or subject as they are now, so it's no longer outdated, and its
   * feedback so far is answered.
   */
  revise(input: ReviseInput): SuggestionView {
    return this.uow.run((repos) => {
      const suggestion = this.pending(repos, input.id);
      if (suggestion.author !== input.author) {
        fail("forbidden", `Only ${suggestion.author}, who made it, can revise this suggestion`);
      }
      const { blocks, title, schedule, note } = input;
      if (blocks === undefined && title === undefined && schedule === undefined && note === undefined) {
        fail("validation", "A revision needs something to change");
      }
      if (note !== undefined && note.length > NOTE_MAX) fail("validation", `A note is at most ${NOTE_MAX} characters`);
      const common = {
        note: note === undefined ? suggestion.note : note || null,
        revision: suggestion.revision + 1,
        revisedAt: this.now(),
      };
      let revised: Suggestion;
      if (suggestion.subject) {
        if (blocks !== undefined) fail("validation", `A ${suggestion.action} suggestion has no blocks`);
        let payload = suggestion.payload;
        if (title !== undefined) {
          if (payload.action !== "rename") fail("validation", `Only a rename takes a title, not a ${suggestion.action}`);
          payload = { action: "rename", title: title.trim() };
        }
        if (schedule !== undefined) {
          if (payload.action !== "schedule") fail("validation", `Only a schedule suggestion takes a schedule, not a ${suggestion.action}`);
          payload = { action: "schedule", schedule };
        }
        const subject = suggestion.subject;
        if (!this.suggested.placeOf(subject)) fail("not_found", `The ${subject.kind} ${subject.id} no longer exists`);
        this.suggested.check(subject, payload);
        revised = { ...suggestion, ...common, payload, base: this.suggested.baseOf(subject, payload)! };
      } else {
        if (title !== undefined || schedule !== undefined) fail("validation", "A block suggestion takes blocks, not a title or schedule");
        let base = suggestion.base;
        if (suggestion.targetId) {
          const target = repos.blocks.getBlock(suggestion.targetId);
          if (!target) fail("validation", "Its target is gone, so it can't be revised; withdraw it and suggest again");
          base = stable(actsOnSubtree(suggestion.action, target!) ? subtree(treeOf(repos, target!)) : own(target!));
        }
        if (blocks !== undefined) {
          if (suggestion.action === "delete") fail("validation", "A delete proposes no blocks");
          if (blocks.length === 0) fail("validation", `A ${suggestion.action} needs the blocks to propose`);
          const old = repos.blocks.getChildren(suggestion.id).map((b): Operation => ({ op: "delete", id: b.id }));
          this.apply(repos, [...old, ...insertOps(suggestion.id, null, blocks)]);
        }
        revised = { ...suggestion, ...common, base };
      }
      repos.suggestions.update(revised);
      return this.view(repos, revised);
    });
  }

  /** An agent's open suggestions (still on their page, or with a subject that still exists), oldest first, optionally in one state. */
  listByAuthor(author: string, state?: SuggestionState): SuggestionView[] {
    const repos = this.uow.repositories;
    return repos.suggestions
      .listPendingByAuthor(author)
      .filter((s) => (s.subject ? this.actions?.placeOf(s.subject) : repos.blocks.getBlock(s.id)))
      .map((s) => this.view(repos, s))
      .filter((s) => state === undefined || s.state === state);
  }

  /** Puts the page back as it was before an approval or rejection, with the suggestion pending again. */
  reopen(id: string): SuggestionView {
    return this.uow.run((repos) => {
      const suggestion = repos.suggestions.get(id) ?? fail("not_found", `Suggestion ${id} does not exist`);
      if (suggestion.subject || suggestion.status === "pending" || !suggestion.undo) {
        fail("validation", "This suggestion can't be undone");
      }
      try {
        repos.blocks.apply(suggestion.undo!);
      } catch (error) {
        if (error instanceof BatchError) fail("validation", "The page changed since, so this can't be undone");
        throw error;
      }
      const reopened: Suggestion = { ...suggestion, status: "pending", undo: null, resolvedAt: null };
      repos.suggestions.update(reopened);
      return this.view(repos, reopened);
    });
  }

  /** Approves a page's pending suggestions in document order, skipping outdated ones and those waiting for changes. */
  approveAll(pageId: string): { approved: number; outdated: number; waiting: number } {
    return this.uow.run((repos) => {
      let approved = 0;
      let outdated = 0;
      let waiting = 0;
      for (const id of this.idsInOrder(repos, pageId)) {
        const view = this.view(repos, repos.suggestions.get(id)!);
        if (view.state === "changes_requested") {
          waiting++;
        } else if (view.outdated) {
          outdated++;
        } else {
          this.approveWithin(repos, id);
          approved++;
        }
      }
      return { approved, outdated, waiting };
    });
  }

  rejectAll(pageId: string): { rejected: number } {
    return this.uow.run((repos) => {
      const ids = this.idsInOrder(repos, pageId);
      for (const id of ids) this.rejectWithin(repos, id);
      return { rejected: ids.length };
    });
  }

  private approveWithin(repos: Repositories, id: string): SuggestionView {
    const suggestion = this.pending(repos, id);
    if (suggestion.subject) {
      if (this.isOutdated(repos, suggestion)) fail("outdated", `The ${suggestion.subject.kind} changed since it was suggested`);
      try {
        this.suggested.run(suggestion.subject, suggestion.payload);
      } catch (error) {
        // The owning domain refused it: the whole approval rolls back.
        if (error instanceof SuggestionError) throw error;
        if (error instanceof Error && "code" in error) fail("validation", error.message);
        throw error;
      }
      return this.resolve(repos, suggestion, "approved", null);
    }
    if (this.isOutdated(repos, suggestion)) fail("outdated", "The block changed since it was suggested");
    const block = repos.blocks.getBlock(id)!;
    const at = this.position(repos, block);
    const proposed = repos.blocks.getChildren(id).map((b) => b.id);

    if (suggestion.action === "insert") {
      // The proposed blocks take the suggestion's place.
      const ops: Operation[] = [...moveOps(proposed, at.parentId, id), { op: "delete", id }];
      const undo: Operation[] = [
        { op: "insert", block: asNew(block), parentId: at.parentId, afterId: at.afterId },
        ...moveOps(proposed, id, null),
      ];
      this.apply(repos, ops);
      return this.resolve(repos, suggestion, "approved", undo);
    }

    const target = repos.blocks.getBlock(suggestion.targetId!)!;
    const targetAt = this.position(repos, target);
    const targetTree = treeOf(repos, target);
    if (suggestion.action === "replace") {
      // The proposed blocks take the target's place. Its children move under the first of them, or after
      // the last when that can't hold them; a table's rows go with the table.
      const whole = actsOnSubtree("replace", target);
      const kept = whole ? [] : repos.blocks.getChildren(target.id).map((b) => b.id);
      const first = proposed[0]!;
      const last = proposed.at(-1)!;
      const keptAt = holdsChildren(repos.blocks.getBlock(first)!.type)
        ? moveOps(kept, first, repos.blocks.getChildren(first).at(-1)?.id ?? null)
        : moveOps(kept, targetAt.parentId, last);
      const ops: Operation[] = [
        ...moveOps(proposed, targetAt.parentId, target.id),
        ...keptAt,
        { op: "delete", id: target.id },
        { op: "delete", id },
      ];
      const restoreTarget: Operation[] = whole
        ? restoreOps(targetTree, targetAt.parentId, targetAt.afterId)
        : [{ op: "insert", block: asNew(target), parentId: targetAt.parentId, afterId: targetAt.afterId }];
      const undo: Operation[] = [
        ...inOrder(
          restoreTarget,
          target.id,
          [{ op: "insert", block: asNew(block), parentId: at.parentId, afterId: at.afterId }],
          id,
        ),
        ...moveOps(kept, target.id, null),
        ...moveOps(proposed, id, null),
      ];
      this.apply(repos, ops);
      return this.resolve(repos, suggestion, "approved", undo);
    }

    // Delete: the target and its subtree go, then the suggestion.
    const undo = inOrder(
      restoreOps(targetTree, targetAt.parentId, targetAt.afterId),
      target.id,
      [{ op: "insert", block: asNew(block), parentId: at.parentId, afterId: at.afterId }],
      id,
    );
    this.apply(repos, [
      { op: "delete", id: target.id },
      { op: "delete", id },
    ]);
    return this.resolve(repos, suggestion, "approved", undo);
  }

  private rejectWithin(repos: Repositories, id: string): SuggestionView {
    const suggestion = this.pending(repos, id);
    if (suggestion.subject) return this.resolve(repos, suggestion, "rejected", null);
    const block = repos.blocks.getBlock(id)!;
    const at = this.position(repos, block);
    const undo = restoreOps(treeOf(repos, block), at.parentId, at.afterId);
    this.apply(repos, [{ op: "delete", id }]);
    return this.resolve(repos, suggestion, "rejected", undo);
  }

  private pending(repos: Repositories, id: string): Suggestion {
    const suggestion = repos.suggestions.get(id) ?? fail("not_found", `Suggestion ${id} does not exist`);
    if (suggestion.status !== "pending") fail("resolved", `This suggestion was already ${suggestion.status}`);
    if (!suggestion.subject && !repos.blocks.getBlock(id)) fail("not_found", `Suggestion ${id} is no longer on its page`);
    return suggestion;
  }

  private resolve(repos: Repositories, suggestion: Suggestion, status: Suggestion["status"], undo: Operation[] | null) {
    const resolved = { ...suggestion, status, undo, resolvedAt: this.now() } as Suggestion;
    repos.suggestions.update(resolved);
    return this.view(repos, resolved);
  }

  private view(repos: Repositories, suggestion: Suggestion): SuggestionView {
    const pending = suggestion.status === "pending";
    const outdated = pending && this.isOutdated(repos, suggestion);
    const all = pending ? repos.suggestions.listFeedback(suggestion.id) : [];
    const feedback = all.filter((f) => f.revision === suggestion.revision);
    const answered = feedback.length === 0 ? (all.filter((f) => f.revision < suggestion.revision).at(-1) ?? null) : null;
    const state: SuggestionState = !pending ? suggestion.status : feedback.length ? "changes_requested" : outdated ? "outdated" : "pending";
    return { ...suggestion, state, outdated, feedback, answered } as SuggestionView;
  }

  private isOutdated(repos: Repositories, suggestion: Suggestion): boolean {
    if (suggestion.subject) return this.suggested.baseOf(suggestion.subject, suggestion.payload) !== suggestion.base;
    if (suggestion.action === "insert" || suggestion.base === null) return false;
    const target = repos.blocks.getBlock(suggestion.targetId!);
    if (!target) return true;
    const now = actsOnSubtree(suggestion.action, target) ? subtree(treeOf(repos, target)) : own(target);
    return stable(now) !== suggestion.base;
  }

  /** Where a block sits: its parent and the sibling before it. */
  private position(repos: Repositories, block: Block): { parentId: string; afterId: string | null } {
    const siblings = repos.blocks.getChildren(block.parentId!);
    const index = siblings.findIndex((b) => b.id === block.id);
    return { parentId: block.parentId!, afterId: index > 0 ? siblings[index - 1]!.id : null };
  }

  /**
   * The blocks of a page's own content (not inside sub-pages), and which of
   * them are inside a suggestion.
   */
  private ownContent(repos: Repositories, pageId: string) {
    const blocks = new Map<string, Block>();
    const inSuggestion = new Set<string>();
    const visit = (node: TreeNode, inside: boolean) => {
      for (const child of node.children ?? []) {
        blocks.set(child.block.id, child.block);
        if (inside) inSuggestion.add(child.block.id);
        visit(child, inside || child.block.type === "suggestion");
      }
    };
    const tree = repos.blocks.loadTree(pageId);
    if (tree) visit(tree, false);
    return { blocks, inSuggestion };
  }

  /** The IDs of a page's pending suggestions, in document order. */
  private idsInOrder(repos: Repositories, pageId: string): string[] {
    const { blocks, inSuggestion } = this.ownContent(repos, pageId);
    return [...blocks.values()]
      .filter((b) => b.type === "suggestion" && !inSuggestion.has(b.id) && repos.suggestions.get(b.id)?.status === "pending")
      .map((b) => b.id);
  }

  private apply(repos: Repositories, ops: Operation[]) {
    try {
      repos.blocks.apply(ops);
    } catch (error) {
      if (error instanceof BatchError) fail("validation", error.error.message);
      throw error;
    }
  }
}
