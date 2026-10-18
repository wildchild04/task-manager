import type { RichText } from "./types";

/** The text of rich-text spans without marks. Mentions are left out (they hold no text of their own). */
export function plainText(text: RichText): string {
  return text.map((span) => (span.mention ? "" : span.text)).join("");
}
