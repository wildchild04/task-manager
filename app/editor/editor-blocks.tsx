import { Button, Checkbox, Divider, IconButton, Menu, Typography } from "@wildchild/design-system";
import { createContext, memo, type ReactNode, useContext, useLayoutEffect, useRef, useState } from "react";

import {
  CalloutFrame,
  HeadingText,
  PageLink,
  ReferenceBlockView,
  SuggestionBox,
  SuggestionsContext,
  TableFrame,
} from "../blocks/block-view";
import { MentionTargetsContext } from "../blocks/rich-text";
import type { ReferenceView } from "../blocks/view-model";
import { CALLOUT_TONES, type CalloutTone } from "~/domain/blocks/types";
import type { Editor } from "~/editor/editor";
import type { EditorBlock, EditorState } from "~/editor/editor-state";
import { cellPosition } from "~/editor/tables";
import { renderRichText } from "./dom-caret";

/** A command in a block's handle menu; with `items`, choosing it opens those instead (a submenu). */
export type HandleMenuItem = { value: string; label: string; disabled?: boolean; onClick: () => void; items?: HandleMenuItem[] };

/** What a block's handle does, provided by the page editor. */
export type HandleActions = {
  /** Selects the block, keeping a block selection it's part of; with `extend`, extends the selection to it. */
  select: (id: string, extend: boolean) => void;
  /** The handle menu's commands for the current selection. */
  menu: () => HandleMenuItem[];
  /** A pointer went down on the handle: it may become a drag, and then `onStart` is called (so the click that follows is ignored). */
  startDrag: (id: string, event: PointerEvent, onStart: () => void) => void;
  /** Puts focus back where the editor's selection is (after the menu closes). */
  refocus: () => void;
};

/** Which blocks are selected (the roots of a block selection), and the blocks' handles, if they have any. */
export type BlockSelectionView = { selected: ReadonlySet<string>; handles: HandleActions | null };

export const BlockSelectionContext = createContext<BlockSelectionView>({ selected: new Set(), handles: null });

/** The six-dot grip, until the design system's icon catalog has `drag_indicator`. */
const GRIP = (
  <svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
    {[9, 15].flatMap((x) => [6, 12, 18].map((y) => <circle key={`${x}-${y}`} cx={x} cy={y} r="1.6" />))}
  </svg>
);

/** The handle beside a block: drag it to move the block (or the selection); click it for the block's commands. */
function BlockHandle({ id, actions }: { id: string; actions: HandleActions }) {
  const [menu, setMenu] = useState<{ anchor: HTMLElement; items: HandleMenuItem[] } | null>(null);
  const dragged = useRef(false);
  return (
    <span
      className="block-handle"
      contentEditable={false}
      // The caret (or the editor's focus) stays where it is.
      onMouseDown={(event) => event.preventDefault()}
      onPointerDown={(event) => {
        dragged.current = false;
        actions.startDrag(id, event.nativeEvent, () => {
          dragged.current = true;
        });
      }}
    >
      <IconButton
        ariaLabel="Drag to move, or open block actions"
        size="small"
        onClick={(event) => {
          if (dragged.current) return;
          actions.select(id, event.shiftKey);
          if (!event.shiftKey) setMenu({ anchor: event.currentTarget, items: actions.menu() });
        }}
      >
        {GRIP}
      </IconButton>
      <Menu
        dense
        open={menu !== null}
        anchorEl={menu?.anchor ?? null}
        options={menu?.items ?? []}
        onClose={() => {
          setMenu(null);
          // The menu hands focus back to the handle as it closes; the editor takes it back after.
          requestAnimationFrame(actions.refocus);
        }}
        onSelect={(value) => {
          const chosen = menu?.items.find((item) => item.value === value);
          // A submenu opens in the menu's place, at the same handle.
          if (chosen?.items && menu) return setMenu({ anchor: menu.anchor, items: chosen.items });
          setMenu(null);
          requestAnimationFrame(actions.refocus);
        }}
      />
    </span>
  );
}

/**
 * The outer element of a block in the editor: it carries the block's ID for
 * selecting, moving and dropping, and shows when the block is selected.
 */
function BlockFrame({
  block,
  id = block?.id,
  as: Tag = "div",
  className,
  readOnly,
  children,
}: {
  block?: EditorBlock;
  id?: string;
  as?: "div" | "li";
  className?: string;
  /** The block has no text of its own (dividers, sub-pages, references, suggestions). */
  readOnly?: boolean;
  children: ReactNode;
}) {
  const { selected, handles } = useContext(BlockSelectionContext);
  return (
    <Tag
      className={className ? `editor-block ${className}` : "editor-block"}
      data-block={id}
      data-selected={id !== undefined && selected.has(id) ? "true" : undefined}
      contentEditable={readOnly ? false : undefined}
    >
      {handles && id !== undefined && <BlockHandle id={id} actions={handles} />}
      {children}
    </Tag>
  );
}

/**
 * One block's editable text. React renders only the element; its content is
 * drawn by `renderRichText` whenever the block's content changes, so React
 * never reconciles text the browser is editing.
 */
export const EditableText = memo(function EditableText({
  block,
  placeholder,
  ariaLabel,
}: {
  block: EditorBlock;
  placeholder?: string;
  ariaLabel?: string;
}) {
  const ref = useRef<HTMLSpanElement>(null);
  const mentions = useContext(MentionTargetsContext);
  const removing = useContext(SuggestionsContext).removing?.has(block.id);
  useLayoutEffect(() => {
    if (ref.current) renderRichText(ref.current, block.content, mentions);
  }, [block.content, mentions]);
  return (
    <span
      ref={ref}
      className={removing ? "editable suggestion-removing" : "editable"}
      contentEditable
      suppressContentEditableWarning
      role="textbox"
      aria-multiline="true"
      aria-label={ariaLabel}
      data-block-id={block.id}
      data-type={block.type}
      data-placeholder={placeholder}
    />
  );
});

/** What block components need from the editor. */
export type BlockActions = {
  toggleTodo: (id: string) => void;
  toggleOpen: (id: string) => void;
  /** Runs an editor command from a block's own controls (table, code and callout menus), then puts the caret back. */
  run: (command: (editor: Editor) => unknown) => void;
};

type BlockProps = {
  state: EditorState;
  block: EditorBlock;
  closed: ReadonlySet<string>;
  references: Record<string, ReferenceView>;
  actions: BlockActions;
};

/** Nested blocks. Under a toggle or todo they line up with its text, past the arrow or checkbox. */
function Children({ gutter, ...props }: Omit<BlockProps, "block"> & { ids: readonly string[]; gutter?: boolean }) {
  if (props.ids.length === 0) return null;
  return (
    <div className={gutter ? "block-children editor-gutter-children" : "block-children"}>
      <EditorBlocks {...props} />
    </div>
  );
}

const EditorBlock = memo(function EditorBlock(props: BlockProps) {
  const { block, state, closed, references, actions } = props;
  const children = <Children {...props} ids={block.children} gutter={block.type === "toggle" || block.type === "todo"} />;
  const text = <EditableText block={block} />;

  switch (block.type) {
    case "paragraph": {
      const inToggle = block.parentId !== null && state.blocks[block.parentId]?.type === "toggle";
      return (
        <BlockFrame block={block}>
          <Typography>
            <EditableText
              block={block}
              placeholder={inToggle ? "Inside the toggle. Write, or type / for blocks" : "Write, or type / for blocks"}
            />
          </Typography>
          {children}
        </BlockFrame>
      );
    }
    case "heading":
      return (
        <BlockFrame block={block}>
          <HeadingText level={Number(block.props.level ?? 1)}>
            <EditableText block={block} placeholder={`Heading ${String(block.props.level ?? 1)}`} />
          </HeadingText>
          {children}
        </BlockFrame>
      );
    case "bulleted_list_item":
    case "numbered_list_item":
      return (
        <BlockFrame block={block} as="li">
          <Typography>{text}</Typography>
          {children}
        </BlockFrame>
      );
    case "todo":
      return (
        <BlockFrame block={block}>
          <div className={block.props.checked ? "editor-row editor-done" : "editor-row"}>
            <span contentEditable={false} className="editor-gutter editor-gutter-todo">
              <Checkbox
                checked={block.props.checked === true}
                onChange={() => actions.toggleTodo(block.id)}
                ariaLabel={block.props.checked ? "Uncheck" : "Check"}
              />
            </span>
            <Typography>
              <EditableText block={block} placeholder="To-do" />
            </Typography>
          </div>
          {children}
        </BlockFrame>
      );
    case "toggle": {
      const open = !closed.has(block.id);
      return (
        <BlockFrame block={block} className="editor-toggle">
          <div className="editor-row">
            <span contentEditable={false} className="editor-gutter editor-gutter-toggle">
              <IconButton
                ariaLabel={open ? "Close toggle" : "Open toggle"}
                icon={open ? "chevron_down" : "chevron_right"}
                size="small"
                onClick={() => actions.toggleOpen(block.id)}
              />
            </span>
            <Typography>
              <EditableText block={block} placeholder="Toggle" />
            </Typography>
          </div>
          {open && children}
        </BlockFrame>
      );
    }
    case "quote":
      return (
        <BlockFrame block={block}>
          <Typography variant="blockquote">
            <EditableText block={block} placeholder="Quote" />
          </Typography>
          {children}
        </BlockFrame>
      );
    case "divider":
      return (
        <BlockFrame block={block} readOnly>
          <Divider />
        </BlockFrame>
      );
    case "page":
      return (
        <BlockFrame block={block} readOnly>
          <PageLink id={block.id} title={block.content} />
        </BlockFrame>
      );
    case "reference":
      return (
        <BlockFrame block={block} readOnly>
          <ReferenceBlockView target={references[block.id] ?? { status: "missing" }} />
        </BlockFrame>
      );
    case "suggestion":
      return <SuggestionBlock id={block.id} />;
    case "table":
      return <TableBlock state={state} table={block} actions={actions} />;
    case "code":
      return <CodeBlockEditor block={block} actions={actions} />;
    case "callout":
      return (
        <BlockFrame block={block}>
          <CalloutFrame
            tone={(block.props.tone as CalloutTone) ?? "default"}
            emoji={<CalloutStyleButton id={block.id} emoji={String(block.props.emoji ?? "💡")} actions={actions} />}
          >
            <Typography>
              <EditableText block={block} placeholder="Callout" />
            </Typography>
            {children}
          </CalloutFrame>
        </BlockFrame>
      );
    default:
      return null;
  }
});

/** A suggestion in the editor: its box, drawn from the page's suggestion views; its blocks are never edited here. */
function SuggestionBlock({ id }: { id: string }) {
  const suggestion = useContext(SuggestionsContext).byId?.[id];
  return (
    <BlockFrame id={id} readOnly>
      {suggestion && <SuggestionBox suggestion={suggestion} />}
    </BlockFrame>
  );
}

/** A button that opens a menu of commands, keeping the caret where it was. */
function CommandMenu({
  label,
  ariaLabel,
  button,
  options,
}: {
  label?: ReactNode;
  ariaLabel: string;
  button?: "text" | "icon";
  options: { value: string; label: ReactNode; disabled?: boolean; onClick: () => void }[];
}) {
  const [anchor, setAnchor] = useState<HTMLElement | null>(null);
  return (
    <span contentEditable={false} onMouseDown={(event) => event.preventDefault()}>
      {button === "icon" ? (
        <IconButton ariaLabel={ariaLabel} icon="menu" size="small" onClick={(event) => setAnchor(event.currentTarget)} />
      ) : (
        <Button size="small" variant="text" ariaLabel={ariaLabel} onClick={(event) => setAnchor(event.currentTarget)}>
          {label}
        </Button>
      )}
      <Menu
        dense
        open={anchor !== null}
        anchorEl={anchor}
        options={options}
        onClose={() => setAnchor(null)}
        onSelect={() => setAnchor(null)}
      />
    </span>
  );
}

/**
 * A table: each cell's editable text in the table frame, and under it adding
 * a row or a column and a menu for the row and column the caret is in.
 */
function TableBlock({ state, table, actions }: { state: EditorState; table: EditorBlock; actions: BlockActions }) {
  const removing = useContext(SuggestionsContext).removing?.has(table.id);
  const rows = table.children.map((rowId) => ({
    id: rowId,
    cells: (state.blocks[rowId]?.children ?? []).map((cellId) => ({
      id: cellId,
      content: state.blocks[cellId] ? <EditableText block={state.blocks[cellId]} ariaLabel="Cell" /> : null,
    })),
  }));
  /** Runs a command on the caret's row and column, if the caret is in this table. */
  const atCaret = (command: (editor: Editor, at: { rowId: string; column: number }) => unknown) =>
    actions.run((editor) => {
      const at = cellPosition(editor.state, editor.selection.blockId);
      if (at?.tableId === table.id) command(editor, at);
    });
  const toggle = (which: "headerRow" | "headerColumn", label: string) => ({
    value: which,
    label: `${table.props[which] ? "✓ " : ""}${label}`,
    onClick: () => actions.run((editor) => editor.toggleTableHeader(table.id, which)),
  });
  return (
    <BlockFrame block={table} className={removing ? "editor-table suggestion-removing" : "editor-table"}>
      <TableFrame headerRow={table.props.headerRow === true} headerColumn={table.props.headerColumn === true} rows={rows} />
      <div className="editor-table-controls" contentEditable={false}>
        <Button size="small" variant="text" onClick={() => actions.run((editor) => editor.addTableRow(table.id))}>
          + Row
        </Button>
        <Button size="small" variant="text" onClick={() => actions.run((editor) => editor.addTableColumn(table.id))}>
          + Column
        </Button>
        <CommandMenu
          ariaLabel="Table actions"
          button="icon"
          options={[
            {
              value: "row-above",
              label: "Insert row above",
              onClick: () => atCaret((e, at) => e.addTableRow(table.id, { rowId: at.rowId, side: "before" })),
            },
            {
              value: "row-below",
              label: "Insert row below",
              onClick: () => atCaret((e, at) => e.addTableRow(table.id, { rowId: at.rowId, side: "after" })),
            },
            {
              value: "col-left",
              label: "Insert column left",
              onClick: () => atCaret((e, at) => e.addTableColumn(table.id, { column: at.column, side: "before" })),
            },
            {
              value: "col-right",
              label: "Insert column right",
              onClick: () => atCaret((e, at) => e.addTableColumn(table.id, { column: at.column, side: "after" })),
            },
            { value: "row-up", label: "Move row up", onClick: () => atCaret((e, at) => e.moveTableRow(at.rowId, -1)) },
            { value: "row-down", label: "Move row down", onClick: () => atCaret((e, at) => e.moveTableRow(at.rowId, 1)) },
            {
              value: "col-left-move",
              label: "Move column left",
              onClick: () => atCaret((e, at) => e.moveTableColumn(table.id, at.column, -1)),
            },
            {
              value: "col-right-move",
              label: "Move column right",
              onClick: () => atCaret((e, at) => e.moveTableColumn(table.id, at.column, 1)),
            },
            { value: "row-delete", label: "Delete row", onClick: () => atCaret((e, at) => e.deleteTableRow(at.rowId)) },
            {
              value: "col-delete",
              label: "Delete column",
              onClick: () => atCaret((e, at) => e.deleteTableColumn(table.id, at.column)),
            },
            toggle("headerRow", "Header row"),
            toggle("headerColumn", "Header column"),
            {
              value: "table-delete",
              label: "Delete table",
              onClick: () => actions.run((editor) => editor.deleteTable(table.id)),
            },
          ]}
        />
      </div>
    </BlockFrame>
  );
}

const CODE_LANGUAGES = ["", "ts", "tsx", "js", "json", "sh", "python", "go", "rust", "sql", "html", "css", "yaml", "md"];

/** A code block: its language, then its text in a monospace surface (plain text, lines kept). */
function CodeBlockEditor({ block, actions }: { block: EditorBlock; actions: BlockActions }) {
  const removing = useContext(SuggestionsContext).removing?.has(block.id);
  const language = String(block.props.language ?? "");
  const languages = CODE_LANGUAGES.includes(language) ? CODE_LANGUAGES : [...CODE_LANGUAGES, language];
  return (
    <BlockFrame block={block} className={removing ? "editor-code suggestion-removing" : "editor-code"}>
      <div className="editor-code-header" contentEditable={false}>
        <CommandMenu
          ariaLabel="Code language"
          label={language || "Plain text"}
          options={languages.map((value) => ({
            value: value || "plain",
            label: value || "Plain text",
            onClick: () => actions.run((editor) => editor.setCodeLanguage(block.id, value)),
          }))}
        />
      </div>
      <pre className="editor-code-body">
        <EditableText block={block} placeholder="Code" ariaLabel={language ? `Code, ${language}` : "Code"} />
      </pre>
    </BlockFrame>
  );
}

const CALLOUT_EMOJIS = ["💡", "ℹ️", "✅", "⚠️", "❗", "📌", "🔥", "📝"];

/** A callout's emoji, which opens its choice of emoji and tone. */
function CalloutStyleButton({ id, emoji, actions }: { id: string; emoji: string; actions: BlockActions }) {
  return (
    <CommandMenu
      ariaLabel="Callout emoji and colour"
      label={emoji}
      options={[
        ...CALLOUT_EMOJIS.map((value) => ({
          value: `emoji-${value}`,
          label: value,
          onClick: () => actions.run((editor) => editor.setCalloutStyle(id, { emoji: value })),
        })),
        ...CALLOUT_TONES.map((tone) => ({
          value: `tone-${tone}`,
          label: `${tone[0]!.toUpperCase()}${tone.slice(1)} colour`,
          onClick: () => actions.run((editor) => editor.setCalloutStyle(id, { tone })),
        })),
      ]}
    />
  );
}

const listTags = { bulleted_list_item: "ul", numbered_list_item: "ol" } as const;
type ListType = keyof typeof listTags;
const listTypeOf = (block: EditorBlock): ListType | undefined => (block.type in listTags ? (block.type as ListType) : undefined);

/** Sibling blocks in order; consecutive list items of one kind share a list, as in the read-only view. */
export function EditorBlocks(props: Omit<BlockProps, "block"> & { ids: readonly string[] }) {
  const { ids, state } = props;
  const groups: EditorBlock[][] = [];
  for (const id of ids) {
    const block = state.blocks[id];
    if (!block) continue;
    const previous = groups.at(-1);
    const type = listTypeOf(block);
    if (type && previous && listTypeOf(previous[0]!) === type) previous.push(block);
    else groups.push([block]);
  }
  return (
    <>
      {groups.map((group) => {
        const type = listTypeOf(group[0]!);
        if (!type) return <EditorBlock key={group[0]!.id} {...props} block={group[0]!} />;
        const List = listTags[type];
        return (
          <List key={group[0]!.id} className="block-list">
            {group.map((block) => (
              <EditorBlock key={block.id} {...props} block={block} />
            ))}
          </List>
        );
      })}
    </>
  );
}
