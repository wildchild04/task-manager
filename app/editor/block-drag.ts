import { behaviorOf } from "~/editor/block-types";
import type { Editor } from "~/editor/editor";
import { getBlock, previousSibling } from "~/editor/editor-state";
import { dropBlocks, type DropTarget } from "~/editor/selection";

/** How far the pointer moves before pressing a handle becomes a drag. */
const DRAG_THRESHOLD = 4;
/** Pointing this far past the start of a block's text drops inside it. */
const NEST_OFFSET = 48;
/** Near the window's top or bottom edge, the page scrolls while dragging. */
const SCROLL_EDGE = 48;

type Drop = { target: DropTarget; top: number; left: number };

/**
 * Drags blocks by a handle with pointer events: after a few pixels of
 * movement the block (or the selection it's part of) is dragged, a line shows
 * where it will go, and releasing drops it there as one undo step. Escape or
 * releasing outside the editor cancels. Calls `onStart` when a drag begins,
 * so the handle can tell a drag from a click, and `onEnd` after it.
 */
export function dragBlocks({
  root,
  editor,
  id,
  event,
  onStart,
  onEnd,
}: {
  root: HTMLElement;
  editor: Editor;
  id: string;
  event: PointerEvent;
  onStart: () => void;
  onEnd: () => void;
}): void {
  if (event.button !== 0 || event.pointerType === "touch") return;
  const [x0, y0] = [event.clientX, event.clientY];
  let roots: string[] | null = null;
  let drop: Drop | null = null;
  const line = document.createElement("div");
  line.className = "block-drop-line";

  /** Each block's frame and where its own text starts; a frame's own part ends where its children begin. */
  const frames = () =>
    [...root.querySelectorAll<HTMLElement>("[data-block]")].filter(
      (frame) => !roots!.some((rootId) => frame.closest(`[data-block="${CSS.escape(rootId)}"]`)),
    );

  /** Where blocks dropped at a point go: before or after the block there, at its level, or inside it. */
  const dropAt = (x: number, y: number): Drop | null => {
    const { state } = editor;
    const box = root.getBoundingClientRect();
    const candidates = frames();
    // The innermost block whose box spans the pointer's height (nested frames come after their parent).
    const frame = candidates.filter((f) => {
      const r = f.getBoundingClientRect();
      return y >= r.top && y < r.bottom;
    }).at(-1);
    let target: DropTarget;
    let top: number;
    let left: number;
    if (!frame) {
      // Below (or above) every block: after the last top-level block, or first.
      const topLevel = getBlock(state, state.rootId).children;
      const first = candidates[0]?.getBoundingClientRect();
      const before = first !== undefined && y < first.top;
      target = { parentId: state.rootId, afterId: before ? null : (topLevel.at(-1) ?? null) };
      const edge = before ? first : candidates.at(-1)?.getBoundingClientRect();
      if (!edge) return null;
      [top, left] = [before ? edge.top : edge.bottom, edge.left];
    } else {
      const blockId = frame.dataset.block!;
      const block = getBlock(state, blockId);
      const r = frame.getBoundingClientRect();
      const children = frame.querySelector<HTMLElement>(":scope > .block-children, :scope > * > .block-children");
      const ownBottom = children ? children.getBoundingClientRect().top : r.bottom;
      const textLeft = frame.querySelector<HTMLElement>(".editable")?.getBoundingClientRect().left ?? r.left;
      const canNest = behaviorOf(block.type).children && block.type !== "table";
      if (y < (r.top + ownBottom) / 2) {
        target = { parentId: block.parentId!, afterId: previousSibling(state, blockId) };
        [top, left] = [r.top, r.left];
      } else if (canNest && (children !== null || x > textLeft + NEST_OFFSET)) {
        target = { parentId: blockId, afterId: null };
        [top, left] = [ownBottom, textLeft + 24];
      } else {
        target = { parentId: block.parentId!, afterId: blockId };
        [top, left] = [r.bottom, r.left];
      }
    }
    if (!dropBlocks(state, roots!, target)) return null;
    return { target, top: top - box.top, left: left - box.left };
  };

  const show = (next: Drop | null) => {
    drop = next;
    if (!next) {
      line.remove();
      return;
    }
    line.style.top = `${next.top - 1}px`;
    line.style.left = `${next.left}px`;
    if (!line.isConnected) root.appendChild(line);
  };

  const begin = () => {
    roots = editor.isSelected(id) ? editor.selectedRoots() : [id];
    if (!editor.isSelected(id)) editor.selectBlock(id);
    root.classList.add("dragging-blocks");
    for (const rootId of roots) root.querySelector(`[data-block="${CSS.escape(rootId)}"]`)?.classList.add("block-dragged");
    onStart();
  };

  const onMove = (move: PointerEvent) => {
    if (!roots) {
      if (Math.hypot(move.clientX - x0, move.clientY - y0) < DRAG_THRESHOLD) return;
      begin();
    }
    move.preventDefault();
    if (move.clientY < SCROLL_EDGE) window.scrollBy(0, -16);
    else if (move.clientY > window.innerHeight - SCROLL_EDGE) window.scrollBy(0, 16);
    show(dropAt(move.clientX, move.clientY));
  };

  const finish = (dropped: boolean) => {
    window.removeEventListener("pointermove", onMove);
    window.removeEventListener("pointerup", onUp);
    window.removeEventListener("keydown", onKey, true);
    line.remove();
    root.classList.remove("dragging-blocks");
    for (const frame of root.querySelectorAll(".block-dragged")) frame.classList.remove("block-dragged");
    if (dropped && roots && drop) editor.dropBlocks(roots, drop.target);
    if (roots) onEnd();
  };
  const onUp = (up: PointerEvent) => {
    const inside = root.contains(document.elementFromPoint(up.clientX, up.clientY));
    finish(inside);
  };
  const onKey = (key: KeyboardEvent) => {
    if (key.key !== "Escape") return;
    key.preventDefault();
    key.stopPropagation();
    finish(false);
  };

  window.addEventListener("pointermove", onMove);
  window.addEventListener("pointerup", onUp);
  window.addEventListener("keydown", onKey, true);
}
