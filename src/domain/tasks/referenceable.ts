import type { EntityRef, ResolvedEntity } from "./types";

/**
 * Resolves an ID of one referenceable kind. Each domain registers its own
 * kind (tasks and blocks here; comments, subtasks and log entries later).
 */
export type EntityResolver = (id: string) => { title: string } | undefined;

export type ReferenceableKinds = Readonly<Record<string, EntityResolver>>;

export function resolveEntity(kinds: ReferenceableKinds, ref: EntityRef): ResolvedEntity | undefined {
  const resolver = kinds[ref.kind];
  if (!resolver) return undefined;
  const found = resolver(ref.id);
  return found
    ? { status: "ok", kind: ref.kind, id: ref.id, title: found.title }
    : { status: "missing", kind: ref.kind, id: ref.id };
}
