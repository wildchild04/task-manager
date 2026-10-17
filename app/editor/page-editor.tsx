import { Alert, Dialog, Stack, TextField, Typography } from "@wildchild/design-system";
import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState, useSyncExternalStore } from "react";
import { useBlocker, useRevalidator } from "react-router";

import type { Operation } from "~/domain/blocks/types";
import { Editor } from "~/editor/editor";
import { caret, caretOrder, getBlock, isCollapsed, type Selection, stateFromTree } from "~/editor/editor-state";
import { linkAt, plain } from "~/editor/rich-text";
import { type SaveStatus, SaveQueue, type SendResult } from "~/editor/save-queue";

import type { EditablePage } from "../lib/page-edit.server";
import {
  caretOnEdgeLine,
  caretRect,
  editableOf,
  offsetAtX,
  readSelection,
  renderRichText,
  textOf,
  writeSelection,
} from "./dom-caret";
import { EditableText, EditorBlocks } from "./editor-blocks";

const STATUS_TEXT: Record<SaveStatus, string> = {
  saved: "Saved",
  pending: "Saving…",
  saving: "Saving…",
  retrying: "Couldn't save, retrying…",
  failed: "Couldn't save",
};

/** Sends one batch to the edit endpoint. Refusals don't retry; network problems do. */
async function sendBatch(page: EditablePage, batch: Operation[]): Promise<SendResult & { version?: string }> {
  try {
    const response = await fetch("/api/edits", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ surface: page.surface, id: page.id, batch }),
    });
    if (response.status === 400 || response.status === 422) {
      const body = (await response.json()) as { message?: string };
      return { ok: false, retry: false, message: body.message ?? "The edit was refused" };
    }
    if (!response.ok) return { ok: false, retry: true };
    const body = (await response.json()) as { version: string };
    return { ok: true, version: body.version };
  } catch {
    return { ok: false, retry: true };
  }
}

/** Asks for a link's URL; an empty URL removes the link. */
function LinkDialog({ initial, onDone }: { initial: string; onDone: (href: string | null | undefined) => void }) {
  const [href, setHref] = useState(initial);
  return (
    <Dialog
      open
      title="Link"
      onClose={() => onDone(undefined)}
      maxWidth="sm"
      fullWidth
      cancelAction={{ label: "Cancel", onClick: () => onDone(undefined) }}
      confirmAction={{ label: href.trim() ? "Save link" : "Remove link", onClick: () => onDone(href.trim() || null) }}
    >
      <TextField
        label="URL"
        fullWidth
        value={href}
        onChange={(event) => setHref(event.target.value)}
        placeholder="https://"
        helperText="Leave empty to remove the link."
      />
    </Dialog>
  );
}

/**
 * Edits one page's title and blocks. Every edit is applied at once and saved
 * in the background; the page's server data is only re-read when it changed
 * elsewhere and nothing is waiting to be saved.
 */
export function PageEditor({ page, titleVariant = "h1" }: { page: EditablePage; titleVariant?: "h1" | "h2" }) {
  const rootRef = useRef<HTMLDivElement>(null);
  const revalidator = useRevalidator();
  const knownVersion = useRef(page.version);
  const restoreSelection = useRef(false);
  const composing = useRef(false);
  const goalX = useRef<number | null>(null);
  const [status, setStatus] = useState<SaveStatus>("saved");
  const [error, setError] = useState<string | null>(null);
  const [linkFor, setLinkFor] = useState<{ selection: Selection; href: string } | null>(null);

  const { editor, queue } = useMemo(() => {
    let editor: Editor;
    const queue = new SaveQueue({
      send: async (batch) => {
        const result = await sendBatch(page, batch);
        if (result.ok && result.version) {
          knownVersion.current = result.version;
          // A new title shows in the navigation, lists and breadcrumbs.
          if (batch.some((op) => op.op === "update" && op.id === editor.state.rootId)) void revalidator.revalidate();
        }
        return result;
      },
      onStatus: setStatus,
      onRejected: (message) => {
        setError(`${message}. The page was reloaded.`);
        knownVersion.current = "";
        void revalidator.revalidate();
      },
    });
    editor = new Editor(stateFromTree(page.tree), { onOps: (ops) => queue.enqueue(ops) });
    return { editor, queue };
    // One editor per page; newer content from the loader is applied below.
  }, [page.surface, page.id]);

  useEffect(() => () => queue.dispose(), [queue]);

  // Content changed elsewhere (e.g. a task's return): take it when nothing is waiting to be saved.
  useEffect(() => {
    if (page.version !== knownVersion.current && !queue.dirty) {
      knownVersion.current = page.version;
      editor.reset(stateFromTree(page.tree));
    }
  }, [page.version, page.tree, editor, queue]);

  useSyncExternalStore(
    useCallback((listener) => editor.subscribe(listener), [editor]),
    () => editor.revision,
    () => editor.revision,
  );

  // After an edit, put the caret where the editor says (block content is drawn first, in child effects).
  useLayoutEffect(() => {
    if (!restoreSelection.current || !rootRef.current) return;
    restoreSelection.current = false;
    writeSelection(rootRef.current, editor.selection);
  });

  // ----- Leaving with unsaved edits -----

  const blocker = useBlocker(({ currentLocation, nextLocation }) => queue.dirty && currentLocation.pathname !== nextLocation.pathname);
  useEffect(() => {
    if (blocker.state !== "blocked") return;
    queue.flush();
    if (status === "saved") blocker.proceed();
  }, [blocker, status, queue]);
  useEffect(() => {
    const warn = (event: BeforeUnloadEvent) => {
      if (!queue.dirty) return;
      queue.flush();
      event.preventDefault();
    };
    window.addEventListener("beforeunload", warn);
    return () => window.removeEventListener("beforeunload", warn);
  }, [queue]);

  // ----- Input -----

  useEffect(() => {
    const root = rootRef.current;
    if (!root) return;

    const sync = (): Selection | null => {
      const selection = readSelection();
      if (selection && root.contains(editableOf(root, selection.blockId))) editor.setSelection(selection);
      return selection;
    };
    const edited = () => {
      restoreSelection.current = true;
      goalX.current = null;
    };

    const onSelectionChange = () => {
      if (!composing.current) sync();
    };

    const onBeforeInput = (event: InputEvent) => {
      if (composing.current || event.isComposing || event.inputType === "insertCompositionText") return;
      event.preventDefault();
      if (!sync()) return;
      const data = event.data ?? event.dataTransfer?.getData("text/plain") ?? "";
      switch (event.inputType) {
        case "insertText":
        case "insertReplacementText":
        case "insertFromPaste":
          if (data) editor.type(data.replace(/\r\n?/g, "\n"));
          break;
        case "insertParagraph":
          editor.enter();
          break;
        case "insertLineBreak":
          editor.lineBreak();
          break;
        case "deleteContentBackward":
        case "deleteByCut":
          editor.deleteBackward();
          break;
        case "deleteWordBackward":
          editor.deleteBackward("word");
          break;
        case "deleteSoftLineBackward":
        case "deleteHardLineBackward":
          editor.setSelection({ ...editor.selection, anchor: 0 });
          editor.deleteBackward();
          break;
        case "deleteContentForward":
          editor.deleteForward();
          break;
        case "deleteWordForward":
          editor.deleteForward("word");
          break;
        case "formatBold":
          editor.toggleMark("bold");
          break;
        case "formatItalic":
          editor.toggleMark("italic");
          break;
        case "formatUnderline":
          editor.toggleMark("underline");
          break;
        case "historyUndo":
          editor.undo();
          break;
        case "historyRedo":
          editor.redo();
          break;
        default:
          return;
      }
      edited();
    };

    const onCompositionStart = () => {
      composing.current = true;
    };

    // While composing, the browser owns the text. At the end, read what changed and apply it as one edit.
    const onCompositionEnd = (event: CompositionEvent) => {
      composing.current = false;
      const element = (event.target as HTMLElement).closest<HTMLElement>("[data-block-id]");
      if (!element) return;
      const id = element.dataset.blockId!;
      const before = plain(getBlock(editor.state, id).content);
      const after = textOf(element).replace(/\n$/, before.endsWith("\n") ? "\n" : "");
      let start = 0;
      while (start < before.length && start < after.length && before[start] === after[start]) start++;
      let end = 0;
      while (end < before.length - start && end < after.length - start && before.at(-1 - end) === after.at(-1 - end)) end++;
      editor.setSelection({ blockId: id, anchor: start, focus: before.length - end });
      const inserted = after.slice(start, after.length - end);
      if (inserted) editor.type(inserted);
      else if (start !== before.length - end) editor.deleteBackward();
      renderRichText(element, getBlock(editor.state, id).content);
      edited();
    };

    /** Moves the caret to another block without editing. */
    const moveTo = (selection: Selection) => {
      editor.setSelection(selection);
      writeSelection(root, selection);
    };

    const neighbour = (id: string, step: -1 | 1) => {
      const order = caretOrder(editor.state, editor.closed).filter((blockId) => editableOf(root, blockId));
      return order[order.indexOf(id) + step];
    };

    const onKeyDown = (event: KeyboardEvent) => {
      if (composing.current || event.isComposing) return;
      const selection = sync();
      if (!selection) return;
      const element = editableOf(root, selection.blockId)!;
      const length = plain(getBlock(editor.state, selection.blockId).content).length;
      const mod = event.metaKey || event.ctrlKey;
      const key = event.key.toLowerCase();
      let handled = true;

      if (event.key === "Enter" && !mod) {
        if (event.shiftKey) editor.lineBreak();
        else editor.enter();
      } else if (event.key === "Backspace" && isCollapsed(selection) && selection.focus === 0 && !mod && !event.altKey) {
        editor.deleteBackward();
      } else if (event.key === "Delete" && isCollapsed(selection) && selection.focus === length && !mod && !event.altKey) {
        editor.deleteForward();
      } else if (event.key === "Tab") {
        if (event.shiftKey) editor.outdent();
        else editor.indent();
      } else if (mod && key === "z") {
        if (event.shiftKey) editor.redo();
        else editor.undo();
      } else if (mod && key === "y") {
        editor.redo();
      } else if (mod && key === "b") {
        editor.toggleMark("bold");
      } else if (mod && key === "i") {
        editor.toggleMark("italic");
      } else if (mod && key === "u") {
        editor.toggleMark("underline");
      } else if (mod && event.shiftKey && key === "s") {
        editor.toggleMark("strikethrough");
      } else if (mod && key === "e") {
        editor.toggleMark("code");
      } else if (mod && key === "k") {
        if (!isCollapsed(selection)) {
          const content = getBlock(editor.state, selection.blockId).content;
          const start = Math.min(selection.anchor, selection.focus);
          const end = Math.max(selection.anchor, selection.focus);
          setLinkFor({ selection, href: linkAt(content, start, end) ?? "" });
        }
      } else {
        handled = false;
        // Arrows leave the block only from its edges; inside it the browser moves the caret.
        const plainArrow = !mod && !event.shiftKey && !event.altKey;
        if (plainArrow && (event.key === "ArrowUp" || event.key === "ArrowDown")) {
          const up = event.key === "ArrowUp";
          if (caretOnEdgeLine(element, up ? "first" : "last")) {
            const target = neighbour(selection.blockId, up ? -1 : 1);
            if (target) {
              goalX.current ??= caretRect()?.left ?? element.getBoundingClientRect().left;
              moveTo(caret(target, offsetAtX(editableOf(root, target)!, goalX.current, up ? "last" : "first")));
              event.preventDefault();
            }
          }
          return;
        }
        if (plainArrow && event.key === "ArrowLeft" && isCollapsed(selection) && selection.focus === 0) {
          const target = neighbour(selection.blockId, -1);
          if (target) {
            moveTo(caret(target, plain(getBlock(editor.state, target).content).length));
            event.preventDefault();
          }
        } else if (plainArrow && event.key === "ArrowRight" && isCollapsed(selection) && selection.focus === length) {
          const target = neighbour(selection.blockId, 1);
          if (target) {
            moveTo(caret(target, 0));
            event.preventDefault();
          }
        }
        if (!event.key.startsWith("Arrow")) goalX.current = null;
        return;
      }
      if (handled) {
        event.preventDefault();
        edited();
      }
    };

    document.addEventListener("selectionchange", onSelectionChange);
    root.addEventListener("beforeinput", onBeforeInput);
    root.addEventListener("keydown", onKeyDown);
    root.addEventListener("compositionstart", onCompositionStart);
    root.addEventListener("compositionend", onCompositionEnd);
    return () => {
      document.removeEventListener("selectionchange", onSelectionChange);
      root.removeEventListener("beforeinput", onBeforeInput);
      root.removeEventListener("keydown", onKeyDown);
      root.removeEventListener("compositionstart", onCompositionStart);
      root.removeEventListener("compositionend", onCompositionEnd);
    };
  }, [editor]);

  const actions = useMemo(
    () => ({
      toggleTodo: (id: string) => editor.toggleTodo(id),
      toggleOpen: (id: string) => editor.toggleOpen(id),
    }),
    [editor],
  );

  const { state, closed } = editor;
  const root = state.blocks[state.rootId]!;

  return (
    <div className="page-editor" ref={rootRef}>
      <div className="editor-status" aria-live="polite">
        <Typography variant="caption" color={status === "failed" || status === "retrying" ? "error" : "text.secondary"}>
          {STATUS_TEXT[status]}
        </Typography>
      </div>
      {error && (
        <Alert severity="error" role="alert">
          {error}
        </Alert>
      )}
      {page.title && (
        <Typography variant={titleVariant}>
          <EditableText block={root} placeholder="Untitled" ariaLabel="Title" />
        </Typography>
      )}
      <div className="editor-body">
        {root.children.length === 0 ? (
          <button
            type="button"
            className="editor-empty"
            onClick={() => {
              editor.setSelection(caret(state.rootId, 0));
              editor.enter();
              restoreSelection.current = true;
            }}
          >
            <Typography color="text.secondary">Empty page. Click to start writing.</Typography>
          </button>
        ) : (
          <EditorBlocks state={state} ids={root.children} closed={closed} references={page.references} actions={actions} />
        )}
      </div>

      {linkFor && (
        <LinkDialog
          initial={linkFor.href}
          onDone={(href) => {
            setLinkFor(null);
            if (href === undefined) return;
            editor.setSelection(linkFor.selection);
            editor.setLink(href);
            restoreSelection.current = true;
          }}
        />
      )}
      {blocker.state === "blocked" && (
        <Dialog
          open
          title="Leave without saving?"
          onClose={() => blocker.reset()}
          cancelAction={{ label: "Stay", onClick: () => blocker.reset() }}
          confirmAction={{ label: "Leave", onClick: () => blocker.proceed() }}
        >
          <Stack spacing={1}>
            <Typography>Some edits haven't been saved yet. If you leave now they'll be lost.</Typography>
          </Stack>
        </Dialog>
      )}
    </div>
  );
}
