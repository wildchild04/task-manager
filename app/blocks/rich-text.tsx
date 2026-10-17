import { InlineCode, Link } from "@wildchild/design-system";
import type { ReactNode } from "react";

import type { Mark, RichText as RichTextValue } from "~/domain/blocks/types";

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

/** Renders text spans with their marks. Links wrap the outside so they stay clickable. */
export function RichText({ value }: { value: RichTextValue }) {
  return (
    <>
      {value.map((span, index) => {
        const marks = [...(span.marks ?? [])].sort((a, b) => Number(typeof a === "object") - Number(typeof b === "object"));
        return <span key={index}>{marks.reduce<ReactNode>((node, mark, i) => applyMark(node, mark, i), span.text)}</span>;
      })}
    </>
  );
}
