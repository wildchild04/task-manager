import { InlineCode, Link } from "@wildchild/design-system";
import { createContext, type ReactNode, useContext } from "react";
import { Link as RouterLink } from "react-router";

import type { Mark, RichText as RichTextValue } from "~/domain/blocks/types";

import type { MentionTargets } from "./view-model";

function applyMark(node: ReactNode, mark: Mark, key: number): ReactNode {
  if (typeof mark === "object") {
    return (
      <Link key={key} href={mark.href}>
        {node}
      </Link>
    );
  }
  switch (mark) {
    case "bold":
      return <strong key={key}>{node}</strong>;
    case "italic":
      return <em key={key}>{node}</em>;
    case "underline":
      return <u key={key}>{node}</u>;
    case "strikethrough":
      return <s key={key}>{node}</s>;
    case "code":
      return <InlineCode key={key}>{node}</InlineCode>;
  }
}

/** What the mentions in what's being rendered show and open; provided by each page view. */
export const MentionTargetsContext = createContext<MentionTargets>({});

/** A mention: the page's (or task's) current title, linked in the app, or a marker when it's gone. */
function Mention({ pageId }: { pageId: string }) {
  const target = useContext(MentionTargetsContext)[pageId];
  if (!target) return <span className="mention mention-missing">Missing page</span>;
  return (
    <Link component={RouterLink} to={target.href} variant="standalone">
      <span className="mention">{target.title}</span>
    </Link>
  );
}

/** Renders text spans with their marks. Links wrap the outside so they stay clickable. */
export function RichText({ value }: { value: RichTextValue }) {
  return (
    <>
      {value.map((span, index) => {
        const marks = [...(span.marks ?? [])].sort((a, b) => Number(typeof a === "object") - Number(typeof b === "object"));
        const inner: ReactNode = span.mention ? <Mention pageId={span.mention.pageId} /> : span.text;
        return <span key={index}>{marks.reduce<ReactNode>((node, mark, i) => applyMark(node, mark, i), inner)}</span>;
      })}
    </>
  );
}
