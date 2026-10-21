import {
  Alert,
  Button,
  Callout,
  Checkbox,
  CodeBlock,
  createAppTheme,
  Divider,
  DocumentTable,
  IconButton,
  Link,
  ReviewContainer,
  Stack,
  Typography,
} from "@wildchild/design-system";
import { createContext, type ReactNode, useContext, useEffect, useState } from "react";
import { Link as RouterLink } from "react-router";

import { RichText } from "./rich-text";
import type { CalloutTone, RichText as RichTextValue } from "~/domain/blocks/types";
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

/** The page title is the `h1`, so heading levels start at `h2`; 5 and 6 share the smallest size. */
const headingVariants = { 1: "h2", 2: "h3", 3: "h4", 4: "h5", 5: "h6" } as const;

/** The theme's smallest heading size, for level 6, which has no HTML element of its own (it would be an `h7`). */
const h6Type = (() => {
  const { fontSize, lineHeight, letterSpacing, fontFamily } = createAppTheme("light").typography.h6;
  return { fontSize, lineHeight, letterSpacing, fontFamily, fontWeight: 400, margin: 0 };
})();

/** A heading of level 1 to 6 below the page title, its real level kept for assistive technology. */
export function HeadingText({ level, children }: { level: number; children: ReactNode }) {
  if (level >= 6) {
    return (
      <div role="heading" aria-level={7} className="block-heading-6" style={h6Type}>
        {children}
      </div>
    );
  }
  return <Typography variant={headingVariants[level as 1 | 2 | 3 | 4 | 5] ?? "h2"}>{children}</Typography>;
}

/** A table's frame: the design system's `DocumentTable`, header row and column as `th`, wide tables scrolling inside the page. */
export function TableFrame({
  headerRow,
  headerColumn,
  rows,
  ...editing
}: {
  headerRow: boolean;
  headerColumn: boolean;
  rows: { id: string; cells: { id: string; content: ReactNode }[] }[];
  /** In the editor: adding rows and columns at the edges, and the table's menu. */
  onAddRow?: () => void;
  onAddColumn?: () => void;
  tableActions?: ReactNode;
}) {
  return <DocumentTable headerRow={headerRow} headerColumn={headerColumn} rows={rows} ariaLabel="Table" {...editing} />;
}

/** A callout's frame: the design system's `Callout` (content, not an announcement) of its tone, its emoji as the icon. */
export function CalloutFrame({ emoji, tone, children }: { emoji: ReactNode; tone: CalloutTone; children: ReactNode }) {
  return (
    <Callout icon={emoji} tone={tone}>
      {children}
    </Callout>
  );
}

/**
 * Checks or unchecks a todo where the read-only view allows it (a posted
 * comment); without it, todos are shown but can't be changed.
 */
export const TodoToggleContext = createContext<((id: string, checked: boolean) => void) | null>(null);


/** Approves or rejects a suggestion; where it's missing (before the editor takes over), the buttons are disabled. */
export type SuggestionDecide = (intent: "approve" | "reject", id: string) => void;

/** What suggestion boxes need from the page around them: how to decide (with `busy` while a decision is on its way). */
export const SuggestionsContext = createContext<{
  /** Blocks a pending replace or delete would remove, marked in place like the box's "Removed" part. */
  removing?: ReadonlySet<string>;
  /** The suggestions by block ID, for the editor, whose blocks don't carry their views. */
  byId?: Readonly<Record<string, SuggestionBlockView>>;
  decide?: SuggestionDecide;
  busy?: boolean;
}>({});

const SUGGESTION_LABELS = { insert: "Suggests adding", replace: "Suggests replacing", delete: "Suggests deleting" } as const;

/** An agent's suggestion: who and what, its note, what it would remove (struck through), what it proposes, and the decision. */
export function SuggestionBox({ suggestion }: { suggestion: SuggestionBlockView }) {
  const context = useContext(SuggestionsContext);
  const { decide, busy } = context;
  const { id, author, action, note, outdated, removed, blocks } = suggestion;
  const label = SUGGESTION_LABELS[action];
  const explanation = outdated ? "The block changed since this was suggested, so it can only be rejected." : undefined;
  return (
    <ReviewContainer
      aria-label={`${author}: ${label}`}
      author={author}
      label={label}
      tone="warning"
      status={outdated ? { label: "Outdated", tone: "error" } : undefined}
      note={note && explanation ? `${note} ${explanation}` : (note ?? explanation)}
      removed={
        removed && (
          // The copy is the removed part itself, so it isn't marked again.
          <SuggestionsContext.Provider value={{ ...context, removing: undefined }}>
            <Blocks blocks={[removed]} />
          </SuggestionsContext.Provider>
        )
      }
      actions={
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
      }
    >
      {blocks.length > 0 ? <Blocks blocks={blocks} /> : undefined}
    </ReviewContainer>
  );
}

/**
 * One content block, read-only. The markup and classes match the editor's
 * block components, so a page looks the same before and after the editor
 * takes over, and toggles and todos behave the same way.
 */
function ContentBlockView({ block }: { block: ContentBlock }) {
  const text = <RichText value={block.content} />;
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
          <HeadingText level={Number(block.props.level ?? 1)}>{text}</HeadingText>
          {children}
        </div>
      );
    case "table":
      return (
        <div className="editor-block">
          <TableFrame
            headerRow={block.props.headerRow !== false}
            headerColumn={block.props.headerColumn === true}
            rows={block.children.map((row) => ({
              id: row.id,
              cells: (row.kind === "content" ? row.children : []).map((cell) => ({
                id: cell.id,
                content: cell.kind === "content" ? <RichText value={cell.content} /> : null,
              })),
            }))}
          />
        </div>
      );
    case "table_row":
    case "table_cell":
      // Rows and cells are drawn by their table.
      return null;
    case "code": {
      const language = String(block.props.language ?? "");
      return (
        <div className="editor-block">
          <CodeBlock
            code={plainText(block.content)}
            {...(language ? { language } : {})}
            copyable
            ariaLabel={language ? `Code, ${language}` : "Code"}
          />
        </div>
      );
    }
    case "callout":
      return (
        <div className="editor-block">
          <CalloutFrame emoji={String(block.props.emoji ?? "💡")} tone={(block.props.tone as CalloutTone) ?? "default"}>
            <Typography>{text}</Typography>
            {children}
          </CalloutFrame>
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
