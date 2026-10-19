import { Alert, Button, Divider, Stack, Typography } from "@wildchild/design-system";
import { useEffect, useRef, useState } from "react";
import { useFetcher, useRevalidator } from "react-router";

import type { TreeNode } from "~/domain/blocks/types";
import type { CommentBlockInput } from "~/domain/comments/types";

import { Blocks, TodoToggleContext } from "../blocks/block-view";
import { MentionTargetsContext } from "../blocks/rich-text";
import { PageEditor } from "../editor/page-editor";
import type { ActionResult } from "../lib/forms.server";
import type { EditablePage } from "../lib/page-edit.server";
import type { CommentView } from "../lib/task-overview.server";
import { useHydrated } from "../lib/use-hydrated";
import { FormDialog } from "./form-dialog";
import { Hidden, StartDialog } from "./task-actions";
import { withBase } from "../lib/base-path";

/** A fresh draft: a comment root with one empty paragraph, ready to type in. */
function draftPage(): EditablePage {
  const now = new Date().toISOString();
  const node = (id: string, type: "comment" | "paragraph", parentId: string | null): TreeNode => ({
    block: { id, type, props: {}, content: [], parentId, owner: null, createdAt: now, updatedAt: now } as TreeNode["block"],
    children: [],
  });
  const root = node(crypto.randomUUID(), "comment", null);
  root.children = [node(crypto.randomUUID(), "paragraph", root.block.id)];
  return {
    surface: "comment",
    id: "draft",
    pageId: root.block.id,
    tree: root,
    version: "draft",
    title: false,
    references: {},
    mentions: {},
    suggestions: {},
  };
}

/**
 * The new-comment editor. The draft stays in the browser until it's posted
 * (button or Cmd/Ctrl+Enter); then a fresh draft takes its place.
 */
function AddComment() {
  const fetcher = useFetcher<ActionResult>();
  const hydrated = useHydrated();
  const [draft, setDraft] = useState<EditablePage | null>(null);
  const blocks = useRef<CommentBlockInput[]>([]);
  useEffect(() => setDraft(draftPage()), []);
  useEffect(() => {
    if (fetcher.state === "idle" && fetcher.data?.ok) {
      blocks.current = [];
      setDraft(draftPage());
    }
  }, [fetcher.state, fetcher.data]);

  const post = () => {
    if (fetcher.state !== "idle") return;
    void fetcher.submit({ intent: "comment-add", blocks: JSON.stringify(blocks.current) }, { method: "post" });
  };
  const error = fetcher.data && !fetcher.data.ok ? (fetcher.data.fieldErrors.text ?? fetcher.data.formError) : undefined;

  return (
    <Stack spacing={1} alignItems="stretch">
      <div className="comment-composer">
        {hydrated && draft ? (
          <PageEditor
            key={draft.tree.block.id}
            page={draft}
            emptyText="Write a comment…"
            draft={{ onChange: (next) => (blocks.current = next), onSubmit: post }}
          />
        ) : (
          <Typography color="text.secondary">Write a comment…</Typography>
        )}
      </div>
      {error && (
        <Alert severity="error" role="alert">
          {error}
        </Alert>
      )}
      <Stack direction="row" spacing={1} alignItems="center">
        <Button onClick={post} disabled={fetcher.state !== "idle"}>
          Comment
        </Button>
        <Typography variant="caption" color="text.secondary">
          Cmd/Ctrl+Enter to post · type / for blocks, @ to mention
        </Typography>
      </Stack>
    </Stack>
  );
}

/** Edits a comment in place, saving as it changes; "Done" shows it read-only again. */
function EditComment({ comment, onDone }: { comment: CommentView; onDone: () => void }) {
  const [editable, setEditable] = useState<EditablePage | null>(null);
  const [failed, setFailed] = useState(false);
  const [statusSlot, setStatusSlot] = useState<HTMLElement | null>(null);
  useEffect(() => {
    fetch(withBase(`/api/comments/${encodeURIComponent(comment.id)}/editable`))
      .then((response) => (response.ok ? (response.json() as Promise<EditablePage>) : Promise.reject(new Error("not found"))))
      .then(setEditable)
      .catch(() => setFailed(true));
  }, [comment.id]);

  if (failed) return <Alert severity="error">This comment can't be edited any more.</Alert>;
  return (
    <Stack spacing={1}>
      <div className="comment-composer">
        {editable ? (
          <PageEditor page={editable} statusSlot={statusSlot} emptyText="Write a comment…" />
        ) : (
          <Typography color="text.secondary">Loading…</Typography>
        )}
      </div>
      <Stack direction="row" spacing={1} alignItems="center">
        <Button size="small" onClick={onDone}>
          Done
        </Button>
        <span ref={setStatusSlot} />
      </Stack>
    </Stack>
  );
}

function DeleteCommentDialog({ comment, onClose }: { comment: CommentView; onClose: () => void }) {
  const fetcher = useFetcher<ActionResult>();
  return (
    <FormDialog open title="Delete comment?" confirmLabel="Delete" fetcher={fetcher} onClose={onClose}>
      <Hidden name="intent" value="comment-delete" />
      <Hidden name="commentId" value={comment.id} />
      <Typography variant="body2">The comment is removed for good. References to it will show as missing.</Typography>
    </FormDialog>
  );
}

type CommentDialog = { kind: "delete" | "start"; comment: CommentView } | null;

function Comment({
  comment,
  editing,
  onEdit,
  onDoneEditing,
  onOpen,
  toggleTodo,
}: {
  comment: CommentView;
  editing: boolean;
  onEdit: () => void;
  onDoneEditing: () => void;
  onOpen: (dialog: CommentDialog) => void;
  toggleTodo: (commentId: string, blockId: string, checked: boolean) => void;
}) {
  return (
    <div id={`comment-${comment.id}`}>
      <Stack spacing={0.5}>
        <Stack direction="row" spacing={1} alignItems="baseline" useFlexGap wrap="wrap">
          <Typography variant="body2">
            <strong>{comment.author}</strong>
          </Typography>
          <Typography variant="caption" color="text.secondary">
            {comment.edited ? `${comment.at} · Edited` : comment.at}
          </Typography>
        </Stack>
        {editing ? (
          <EditComment comment={comment} onDone={onDoneEditing} />
        ) : (
          <>
            <MentionTargetsContext.Provider value={comment.mentions}>
              <TodoToggleContext.Provider value={(id, checked) => toggleTodo(comment.id, id, checked)}>
                <div>
                  <Blocks blocks={comment.blocks} />
                </div>
              </TodoToggleContext.Provider>
            </MentionTargetsContext.Provider>
            <Stack direction="row" spacing={1}>
              <Button size="small" variant="text" onClick={onEdit}>
                Edit
              </Button>
              <Button size="small" variant="text" color="error" onClick={() => onOpen({ kind: "delete", comment })}>
                Delete
              </Button>
              <Button size="small" variant="text" onClick={() => onOpen({ kind: "start", comment })}>
                Start exploration…
              </Button>
            </Stack>
          </>
        )}
      </Stack>
    </div>
  );
}

/** The task's comments, oldest first, with writing, editing in place, deleting and starting an exploration from one. */
export function TaskComments({ comments }: { comments: CommentView[] }) {
  const [dialog, setDialog] = useState<CommentDialog>(null);
  const [editingId, setEditingId] = useState<string | null>(null);
  const revalidator = useRevalidator();
  const close = () => setDialog(null);
  // Checking a todo in a posted comment is an edit of the comment, saved at once.
  const toggleTodo = (commentId: string, blockId: string, checked: boolean) => {
    void fetch(withBase("/api/edits"), {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ surface: "comment", id: commentId, batch: [{ op: "update", id: blockId, props: { checked } }] }),
    }).then(() => revalidator.revalidate());
  };

  return (
    <Stack spacing={2}>
      {comments.length === 0 ? (
        <Typography variant="body2" color="text.secondary">
          No comments yet.
        </Typography>
      ) : (
        <Stack spacing={2} divider={<Divider />}>
          {comments.map((comment) => (
            <Comment
              key={comment.id}
              comment={comment}
              editing={editingId === comment.id}
              onEdit={() => setEditingId(comment.id)}
              onDoneEditing={() => {
                setEditingId(null);
                // Show the saved content and the "Edited" marker.
                void revalidator.revalidate();
              }}
              onOpen={setDialog}
              toggleTodo={toggleTodo}
            />
          ))}
        </Stack>
      )}
      <AddComment />

      {dialog?.kind === "delete" && <DeleteCommentDialog comment={dialog.comment} onClose={close} />}
      {dialog?.kind === "start" && (
        <StartDialog
          open
          onClose={close}
          intent="start-exploration"
          commentId={dialog.comment.id}
          title="Start exploration from this comment"
          description="Creates an exploration that references this comment, and opens it."
        />
      )}
    </Stack>
  );
}
