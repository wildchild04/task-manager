import { Checkbox, Divider, IconButton, Typography } from "@wildchild/design-system";
import { memo, useContext, useLayoutEffect, useRef } from "react";

import { PageLink, ReferenceBlockView } from "../blocks/block-view";
import { MentionTitlesContext } from "../blocks/rich-text";
import type { ReferenceView } from "../blocks/view-model";
import type { EditorBlock, EditorState } from "~/editor/editor-state";
import { renderRichText } from "./dom-caret";

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
  const mentions = useContext(MentionTitlesContext);
  useLayoutEffect(() => {
    if (ref.current) renderRichText(ref.current, block.content, mentions);
  }, [block.content, mentions]);
  return (
    <span
      ref={ref}
      className="editable"
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
};

type BlockProps = {
  state: EditorState;
  block: EditorBlock;
  closed: ReadonlySet<string>;
  references: Record<string, ReferenceView>;
  actions: BlockActions;
};

const headingVariants = { 1: "h2", 2: "h3", 3: "h4" } as const;

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
        <div className="editor-block">
          <Typography>
            <EditableText
              block={block}
              placeholder={inToggle ? "Inside the toggle. Write, or type / for blocks" : "Write, or type / for blocks"}
            />
          </Typography>
          {children}
        </div>
      );
    }
    case "heading":
      return (
        <div className="editor-block">
          <Typography variant={headingVariants[block.props.level as 1 | 2 | 3] ?? "h2"}>
            <EditableText block={block} placeholder={`Heading ${String(block.props.level ?? 1)}`} />
          </Typography>
          {children}
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
    case "todo":
      return (
        <div className="editor-block">
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
        </div>
      );
    case "toggle": {
      const open = !closed.has(block.id);
      return (
        <div className="editor-block editor-toggle">
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
        </div>
      );
    }
    case "quote":
      return (
        <div className="editor-block">
          <Typography variant="blockquote">
            <EditableText block={block} placeholder="Quote" />
          </Typography>
          {children}
        </div>
      );
    case "divider":
      return (
        <div className="editor-block" contentEditable={false}>
          <Divider />
        </div>
      );
    case "page":
      return (
        <div className="editor-block" contentEditable={false}>
          <PageLink id={block.id} title={block.content} />
        </div>
      );
    case "reference":
      return (
        <div className="editor-block" contentEditable={false}>
          <ReferenceBlockView target={references[block.id] ?? { status: "missing" }} />
        </div>
      );
    default:
      return null;
  }
});

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
