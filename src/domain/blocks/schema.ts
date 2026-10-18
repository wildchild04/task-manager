import { z } from "zod";

import { BlockOperationError } from "./errors";
import type { BlockType, RichText } from "./types";
import { isTextType, MENTION_TEXT } from "./types";

const empty = z.object({}).strict();

/** Props schema per block type. Defaults apply when a prop is omitted. */
export const propsSchemas = {
  page: empty,
  paragraph: empty,
  heading: z.object({ level: z.union([z.literal(1), z.literal(2), z.literal(3)]).default(1) }).strict(),
  todo: z.object({ checked: z.boolean().default(false) }).strict(),
  bulleted_list_item: empty,
  numbered_list_item: empty,
  toggle: empty,
  quote: empty,
  divider: empty,
  reference: z.object({ targetId: z.string().min(1) }).strict(),
  comment: empty,
} satisfies Record<BlockType, z.ZodType>;

const markSchema = z.union([
  z.enum(["bold", "italic", "underline", "strikethrough", "code"]),
  z.object({ type: z.literal("link"), href: z.string().min(1) }).strict(),
]);

export const richTextSchema = z.array(
  z
    .object({
      text: z.string(),
      marks: z.array(markSchema).optional(),
      mention: z.object({ pageId: z.string().min(1) }).strict().optional(),
    })
    .strict()
    .refine((span) => !span.mention || span.text === MENTION_TEXT, { message: "A mention holds exactly one placeholder character" })
    .refine((span) => !span.mention || !(span.marks ?? []).some((mark) => typeof mark === "object"), {
      message: "A mention can't be a link",
    }),
);

export const blockTypeSchema = z.enum([
  "page",
  "paragraph",
  "heading",
  "todo",
  "bulleted_list_item",
  "numbered_list_item",
  "toggle",
  "quote",
  "divider",
  "reference",
  "comment",
]);

function toError(prefix: string, error: z.ZodError): BlockOperationError {
  const issue = error.issues[0];
  const path = [prefix, ...(issue?.path ?? []).map((p) => (typeof p === "symbol" ? String(p) : p))];
  return new BlockOperationError("validation", `Invalid ${path.join(".")}: ${issue?.message ?? "invalid value"}`, path);
}

export function parseType(type: unknown): BlockType {
  const result = blockTypeSchema.safeParse(type);
  if (!result.success) {
    throw new BlockOperationError("validation", `Unknown block type: ${String(type)}`, ["type"]);
  }
  return result.data;
}

/** Validates props for a type, filling defaults. Throws a validation error naming the invalid prop. */
export function parseProps(type: BlockType, props: unknown): Record<string, unknown> {
  const result = propsSchemas[type].safeParse(props ?? {});
  if (!result.success) throw toError("props", result.error);
  return result.data as Record<string, unknown>;
}

/** Validates content for a type. Non-text types only accept empty content. */
export function parseContent(type: BlockType, content: unknown): RichText {
  const result = richTextSchema.safeParse(content ?? []);
  if (!result.success) throw toError("content", result.error);
  if (!isTextType(type) && result.data.length > 0) {
    throw new BlockOperationError("validation", `A ${type} block cannot have content`, ["content"]);
  }
  if (type === "page" && result.data.some((span) => span.mention)) {
    throw new BlockOperationError("validation", "A page title cannot contain mentions", ["content"]);
  }
  return result.data as RichText;
}
