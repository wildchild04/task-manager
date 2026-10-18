import { z } from "zod";

/** A refusal with its HTTP status and a short code agents can act on. */
export class AgentError extends Error {
  constructor(
    readonly status: number,
    readonly code: string,
    message: string,
  ) {
    super(message);
  }
}

// ----- IDs -----

/** IDs go out as their first 8 characters. */
export const short = (id: string) => id.slice(0, 8);

/**
 * Finds the full ID an agent means: an exact match, or the only ID starting
 * with a prefix of at least 6 characters.
 */
export function resolveId(given: string, candidates: Iterable<string>, what: string): string {
  const all = [...candidates];
  if (all.includes(given)) return given;
  if (given.length >= 6) {
    const matches = all.filter((id) => id.startsWith(given));
    if (matches.length === 1) return matches[0]!;
    if (matches.length > 1)
      throw new AgentError(409, "ambiguous", `More than one ${what} starts with "${given}"; use more characters`);
  }
  throw new AgentError(404, "not_found", `No ${what} "${given}"`);
}

// ----- Caps -----

export const limitSchema = (fallback: number) => z.coerce.number().int().min(1).max(50).default(fallback);
export const maxCharsSchema = (fallback: number) => z.coerce.number().int().min(1).max(20000).default(fallback);
export const offsetSchema = z.coerce.number().int().min(0).default(0);

/** A page of a sorted list: items after the cursor's key, at most `limit`. */
export function pageOf<T>(items: readonly T[], key: (item: T) => string, limit: number, cursor?: string) {
  let start = 0;
  if (cursor) {
    let after: string;
    try {
      after = Buffer.from(cursor, "base64url").toString("utf8");
    } catch {
      throw new AgentError(400, "bad_request", "Invalid cursor");
    }
    const index = items.findIndex((item) => key(item) === after);
    start = index >= 0 ? index + 1 : items.length;
  }
  const page = items.slice(start, start + limit);
  const more = start + limit < items.length;
  return {
    items: page,
    more,
    ...(more ? { cursor: Buffer.from(key(page.at(-1)!), "utf8").toString("base64url") } : {}),
  };
}

/** Text cut at `maxChars` from `offset`, never inside a surrogate pair; `offset` tells where to continue. */
export function cut(text: string, maxChars: number, offset = 0) {
  if (offset >= text.length) return { markdown: "", more: false };
  let end = Math.min(text.length, offset + maxChars);
  if (end < text.length && /[\uD800-\uDBFF]/.test(text[end - 1]!)) end -= 1;
  const more = end < text.length;
  return { markdown: text.slice(offset, end), more, ...(more ? { offset: end } : {}) };
}

/** Parses a request's parameters, refusing with the first problem. */
export function parse<T>(schema: z.ZodType<T>, input: unknown): T {
  const result = schema.safeParse(input);
  if (!result.success) {
    const issue = result.error.issues[0];
    throw new AgentError(400, "bad_request", `${issue?.path.join(".") || "request"}: ${issue?.message ?? "invalid"}`);
  }
  return result.data;
}
