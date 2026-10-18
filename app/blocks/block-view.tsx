import { Alert, Checkbox, Divider, Icon, Link, Stack, Typography } from "@wildchild/design-system";
import { createContext, type ReactNode, useContext, useEffect, useState } from "react";
import { Link as RouterLink } from "react-router";

import { RichText } from "./rich-text";
import type { RichText as RichTextValue } from "~/domain/blocks/types";
import type { ReferenceView, ViewBlock } from "./view-model";
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

function Children({ blocks }: { blocks: ViewBlock[] }) {
  if (blocks.length === 0) return null;
  return (
    <div className="block-children">
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

/** A todo's checkbox; it shows a click at once, before the saved content comes back. */
function TodoCheckbox({ id, label, checked }: { id: string; label: ReactNode; checked: boolean }) {
  const toggle = useContext(TodoToggleContext);
  const [shown, setShown] = useState(checked);
  useEffect(() => setShown(checked), [checked]);
  return (
    <Checkbox
      label={label}
      checked={shown}
      disabled={!toggle}
      onChange={(next) => {
        setShown(next);
        toggle?.(id, next);
      }}
    />
  );
}

function ContentBlockView({ block }: { block: ContentBlock }) {
  const text = <RichText value={block.content} />;
  switch (block.type) {
    case "paragraph":
      return (
        <>
          <Typography gutterBottom>{text}</Typography>
          <Children blocks={block.children} />
        </>
      );
    case "heading":
      return (
        <>
          <Typography variant={headingVariants[block.props.level as 1 | 2 | 3]} gutterBottom>
            {text}
          </Typography>
          <Children blocks={block.children} />
        </>
      );
    case "todo":
      return (
        <>
          <div className="block-todo">
            <TodoCheckbox id={block.id} label={text} checked={block.props.checked === true} />
          </div>
          <Children blocks={block.children} />
        </>
      );
    case "toggle":
      return (
        <>
          <Stack direction="row" spacing={0.5} alignItems="center">
            <Icon name="chevron_down" size="small" />
            <Typography>{text}</Typography>
          </Stack>
          <Children blocks={block.children} />
        </>
      );
    case "quote":
      return (
        <>
          <Typography variant="blockquote" gutterBottom>
            {text}
          </Typography>
          <Children blocks={block.children} />
        </>
      );
    case "divider":
      return <Divider />;
    case "bulleted_list_item":
    case "numbered_list_item":
      return (
        <li>
          <Typography>{text}</Typography>
          <Children blocks={block.children} />
        </li>
      );
  }
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
      return <PageLink id={block.id} title={block.title} />;
    case "reference":
      return <ReferenceBlockView target={block.target} />;
    case "content":
      return <ContentBlockView block={block} />;
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
