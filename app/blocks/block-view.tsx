import { Alert, Button, Checkbox, Chip, Divider, IconButton, Link, Stack, Typography } from "@wildchild/design-system";
import { createContext, type ReactNode, useContext, useEffect, useState } from "react";
import { Link as RouterLink } from "react-router";

import { RichText } from "./rich-text";
import type { RichText as RichTextValue } from "~/domain/blocks/types";
import type { ReferenceView, SuggestionBlockView, ViewBlock } from "./view-model";
import { plainText } from "./view-model";

type ContentBlock = Extract<ViewBlock, { kind: "content" }>;

/** A page inside or referenced from a page: its own block row, as Notion shows sub-pages. */
export function PageLink({ id, title }: { id: string; title: RichTextValue }) {
  return (
    <div className="block-page-link">
      <Link component={RouterLink} to={`/pages/${id}`}>
        {plainText(title) || "Untitled"}
      </Link>
    </div>
  );
}

/** Nested blocks; under a todo or toggle (`gutter`) they line up with its text. */
function Children({ blocks, gutter }: { blocks: ViewBlock[]; gutter?: boolean }) {
  if (blocks.length === 0) return null;
  return (
    <div className={gutter ? "block-children editor-gutter-children" : "block-children"}>
      <Blocks blocks={blocks} />
    </div>
  );
}

const headingVariants = { 1: "h2", 2: "h3", 3: "h4" } as const;

/**
 * Checks or unchecks a todo where the read-only view allows it (a posted
 * comment); without it, todos are shown but can't be changed.
 */
export const TodoToggleContext = createContext<((id: string, checked: boolean) => void) | null>(null);


/** Approves or rejects a suggestion; where it's missing (before the editor takes over), the buttons are disabled. */
export type SuggestionDecide = (intent: "approve" | "reject", id: string) => void;

/**
 * What suggestion boxes need from the page around them: the targets to mark,
 * and how to decide (with `busy` while a decision is on its way).
 */
export const SuggestionsContext = createContext<{
  marked: ReadonlySet<string>;
  /** The suggestions by block ID, for the editor, whose blocks don't carry their views. */
  byId?: Readonly<Record<string, SuggestionBlockView>>;
  decide?: SuggestionDecide;
  busy?: boolean;
}>({ marked: new Set() });

/** A block's text, highlighted when a pending suggestion would replace or delete the block. */
export function MarkedText({ id, children }: { id: string; children: ReactNode }) {
  const { marked } = useContext(SuggestionsContext);
  return marked.has(id) ? <span className="suggestion-target">{children}</span> : <>{children}</>;
}

const SUGGESTION_LABELS = { insert: "Suggests adding", replace: "Suggests replacing", delete: "Suggests deleting" } as const;

/** An agent's suggestion: who and what, its note, what it would remove (struck through), what it proposes, and the decision. */
export function SuggestionBox({ suggestion }: { suggestion: SuggestionBlockView }) {
  const context = useContext(SuggestionsContext);
  const { decide, busy } = context;
  const { id, author, action, note, outdated, removed, blocks } = suggestion;
  const label = SUGGESTION_LABELS[action];
  return (
    <section className="suggestion-box" role="group" aria-label={`${author}: ${label}`} contentEditable={false}>
      <div className="suggestion-header">
        <Stack direction="row" spacing={1} alignItems="center" wrap="wrap">
          <Typography variant="body2">
            <strong>{author}</strong>
          </Typography>
          <Typography variant="body2" color="text.secondary">
            {label}
          </Typography>
          {outdated && <Chip size="small" variant="outlined" color="error" label="Outdated" />}
        </Stack>
        <Stack direction="row" spacing={1} alignItems="center">
          <Button size="small" variant="text" disabled={!decide || busy} onClick={() => decide?.("reject", id)}>
            Reject
          </Button>
          {!outdated && (
            <Button size="small" variant="contained" disabled={!decide || busy} onClick={() => decide?.("approve", id)}>
              Approve
            </Button>
          )}
        </Stack>
      </div>
      {note && (
        <Typography variant="body2" color="text.secondary">
          {note}
        </Typography>
      )}
      {outdated && (
        <Typography variant="body2" color="text.secondary">
          The block changed since this was suggested, so it can only be rejected.
        </Typography>
      )}
      {removed && (
        <div className="suggestion-removed" role="group" aria-label="Removed">
          <Typography variant="caption" color="text.secondary">
            Removed
          </Typography>
          {/* The copy isn't the target itself, so it isn't marked as one. */}
          <SuggestionsContext.Provider value={{ ...context, marked: new Set() }}>
            <div className="suggestion-removed-content">
              <Blocks blocks={[removed]} />
            </div>
          </SuggestionsContext.Provider>
        </div>
      )}
      {blocks.length > 0 && (
        <div className="suggestion-body">
          <Blocks blocks={blocks} />
        </div>
      )}
    </section>
  );
}

/**
 * One content block, read-only. The markup and classes match the editor's
 * block components, so a page looks the same before and after the editor
 * takes over, and toggles and todos behave the same way.
 */
function ContentBlockView({ block }: { block: ContentBlock }) {
  const text = (
    <MarkedText id={block.id}>
      <RichText value={block.content} />
    </MarkedText>
  );
  const children = <Children blocks={block.children} />;
  switch (block.type) {
    case "paragraph":
      return (
        <div className="editor-block">
          <Typography>{text}</Typography>
          {children}
        </div>
      );
    case "heading":
      return (
        <div className="editor-block">
          <Typography variant={headingVariants[block.props.level as 1 | 2 | 3]}>{text}</Typography>
          {children}
        </div>
      );
    case "todo": {
      const checked = block.props.checked === true;
      return (
        <div className="editor-block">
          <TodoRow id={block.id} checked={checked} text={text} />
          <Children blocks={block.children} gutter />
        </div>
      );
    }
    case "toggle":
      return <ToggleBlock text={text} childBlocks={block.children} />;
    case "quote":
      return (
        <div className="editor-block">
          <Typography variant="blockquote">{text}</Typography>
          {children}
        </div>
      );
    case "divider":
      return (
        <div className="editor-block">
          <Divider />
        </div>
      );
    case "bulleted_list_item":
    case "numbered_list_item":
      return (
        <li className="editor-block">
          <Typography>{text}</Typography>
          {children}
        </li>
      );
  }
}

/** A todo: its checkbox in the gutter, its text, struck through when done. */
function TodoRow({ id, checked, text }: { id: string; checked: boolean; text: ReactNode }) {
  const toggle = useContext(TodoToggleContext);
  const [shown, setShown] = useState(checked);
  useEffect(() => setShown(checked), [checked]);
  return (
    <div className={shown ? "editor-row editor-done" : "editor-row"}>
      <span className="editor-gutter editor-gutter-todo">
        <Checkbox
          checked={shown}
          disabled={!toggle}
          ariaLabel={shown ? "Uncheck" : "Check"}
          onChange={(next) => {
            setShown(next);
            toggle?.(id, next);
          }}
        />
      </span>
      <Typography>
        <span className="block-text">{text}</span>
      </Typography>
    </div>
  );
}

/** A toggle: folded at first; its arrow opens and closes it (only for this view); its children hang off a guide line. */
function ToggleBlock({ text, childBlocks }: { text: ReactNode; childBlocks: ViewBlock[] }) {
  const [open, setOpen] = useState(false);
  return (
    <div className="editor-block editor-toggle">
      <div className="editor-row">
        <span className="editor-gutter editor-gutter-toggle">
          <IconButton
            ariaLabel={open ? "Close toggle" : "Open toggle"}
            icon={open ? "chevron_down" : "chevron_right"}
            size="small"
            onClick={() => setOpen(!open)}
          />
        </span>
        <Typography>{text}</Typography>
      </div>
      {open && <Children blocks={childBlocks} gutter />}
    </div>
  );
}

export function ReferenceBlockView({ target }: { target: ReferenceView }) {
  switch (target.status) {
    case "page":
      return <PageLink id={target.pageId} title={target.title} />;
    case "block":
      return <Blocks blocks={[target.block]} />;
    case "missing":
      return (
        <Alert severity="warning" role="status">
          Missing reference: the referenced block was deleted.
        </Alert>
      );
    case "cycle":
      return (
        <Alert severity="info" role="status">
          Circular reference: this block refers back to itself.
        </Alert>
      );
  }
}

function BlockView({ block }: { block: ViewBlock }) {
  switch (block.kind) {
    case "subpage":
      return (
        <div className="editor-block">
          <PageLink id={block.id} title={block.title} />
        </div>
      );
    case "reference":
      return (
        <div className="editor-block">
          <ReferenceBlockView target={block.target} />
        </div>
      );
    case "content":
      return <ContentBlockView block={block} />;
    case "suggestion":
      return (
        <div className="editor-block">
          <SuggestionBox suggestion={block} />
        </div>
      );
  }
}

const listTypes = { bulleted_list_item: "ul", numbered_list_item: "ol" } as const;
type ListType = keyof typeof listTypes;

const listTypeOf = (block: ViewBlock): ListType | undefined =>
  block.kind === "content" && block.type in listTypes ? (block.type as ListType) : undefined;

/**
 * Renders sibling blocks in order. Consecutive list items of the same kind
 * share one list, so numbering restarts after any other block.
 */
export function Blocks({ blocks }: { blocks: ViewBlock[] }) {
  const groups: ViewBlock[][] = [];
  for (const block of blocks) {
    const previous = groups.at(-1);
    const type = listTypeOf(block);
    if (type && previous && listTypeOf(previous[0]!) === type) previous.push(block);
    else groups.push([block]);
  }

  return (
    <>
      {groups.map((group) => {
        const type = listTypeOf(group[0]!);
        if (!type) return <BlockView key={group[0]!.id} block={group[0]!} />;
        const List = listTypes[type];
        return (
          <List key={group[0]!.id} className="block-list">
            {group.map((block) => (
              <BlockView key={block.id} block={block} />
            ))}
          </List>
        );
      })}
    </>
  );
}
