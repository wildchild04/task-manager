import type { Suggestion, SuggestionFeedback } from "./types";

export interface SuggestionRepository {
  insert(suggestion: Suggestion): void;
  get(id: string): Suggestion | undefined;
  /** Replaces the stored record. */
  update(suggestion: Suggestion): void;
  /** Suggestions whose ID starts with `prefix`. */
  findByPrefix(prefix: string): Suggestion[];
  /** Pending suggestions, oldest first. */
  listPending(): Suggestion[];
  /** One agent's pending suggestions, oldest first. */
  listPendingByAuthor(author: string): Suggestion[];
  addFeedback(feedback: SuggestionFeedback): void;
  /** A suggestion's feedback, oldest first. */
  listFeedback(suggestionId: string): SuggestionFeedback[];
}
