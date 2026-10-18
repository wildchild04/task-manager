import type { NewBlock } from "~/domain/blocks/types";

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
