import type { Suggestion } from "./types";

export interface SuggestionRepository {
  insert(suggestion: Suggestion): void;
  get(id: string): Suggestion | undefined;
  /** Replaces the stored record. */
  update(suggestion: Suggestion): void;
  /** Pending suggestions, oldest first. */
  listPending(): Suggestion[];
}
