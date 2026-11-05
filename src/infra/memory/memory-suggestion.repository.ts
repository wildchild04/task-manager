import type { SuggestionRepository } from "~/domain/suggestions/suggestion.repository";
import type { Suggestion, SuggestionFeedback } from "~/domain/suggestions/types";

type State = { suggestions: Map<string, Suggestion>; feedback: readonly SuggestionFeedback[] };

/** Writes replace the map and the list, so unit-of-work snapshots are never mutated. Insertion order is creation order. */
export class MemorySuggestionRepository implements SuggestionRepository {
  private suggestions = new Map<string, Suggestion>();
  private feedback: readonly SuggestionFeedback[] = [];

  insert(suggestion: Suggestion): void {
    this.suggestions = new Map(this.suggestions).set(suggestion.id, suggestion);
  }

  get(id: string): Suggestion | undefined {
    return this.suggestions.get(id);
  }

  update(suggestion: Suggestion): void {
    this.insert(suggestion);
  }

  findByPrefix(prefix: string): Suggestion[] {
    return [...this.suggestions.values()].filter((s) => s.id.startsWith(prefix));
  }

  listPending(): Suggestion[] {
    return [...this.suggestions.values()].filter((s) => s.status === "pending");
  }

  listPendingByAuthor(author: string): Suggestion[] {
    return this.listPending().filter((s) => s.author === author);
  }

  addFeedback(feedback: SuggestionFeedback): void {
    this.feedback = [...this.feedback, feedback];
  }

  listFeedback(suggestionId: string): SuggestionFeedback[] {
    return this.feedback.filter((f) => f.suggestionId === suggestionId);
  }

  snapshot(): State {
    return { suggestions: this.suggestions, feedback: this.feedback };
  }

  restore(snapshot: State): void {
    this.suggestions = snapshot.suggestions;
    this.feedback = snapshot.feedback;
  }
}
