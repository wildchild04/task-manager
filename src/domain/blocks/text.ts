import type { RichText } from "./types";

/** The text of rich-text spans without marks. */
export function plainText(text: RichText): string {
  return text.map((span) => span.text).join("");
}
