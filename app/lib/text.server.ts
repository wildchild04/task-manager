import type { NewBlock, TreeNode } from "~/domain/blocks/types";
import { plainText } from "~/domain/blocks/text";

/**
 * Plain text as paragraph blocks: paragraphs are separated by blank lines,
 * trimmed, and empty ones dropped. Single newlines stay inside a paragraph.
 */
export function paragraphsFromText(text: string, newId: () => string = () => crypto.randomUUID()): NewBlock[] {
  return text
    .replace(/\r\n?/g, "\n")
    .split(/\n\s*\n/)
    .map((paragraph) => paragraph.trim())
    .filter((paragraph) => paragraph.length > 0)
    .map((paragraph) => ({ id: newId(), type: "paragraph", content: [{ text: paragraph }] }));
}

/** A comment's content as editable text: each block's text, separated by blank lines. */
export function textOfBody(body: TreeNode | undefined): { text: string; onlyParagraphs: boolean } {
  const texts: string[] = [];
  let onlyParagraphs = true;
  const visit = (node: TreeNode) => {
    if (node.block.type !== "paragraph" || (node.children?.length ?? 0) > 0) onlyParagraphs = false;
    const text = plainText(node.block.content);
    if (text) texts.push(text);
    node.children?.forEach(visit);
  };
  body?.children?.forEach(visit);
  return { text: texts.join("\n\n"), onlyParagraphs };
}
