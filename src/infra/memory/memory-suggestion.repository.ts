import type { SuggestionRepository } from "~/domain/suggestions/suggestion.repository";
import type { Suggestion } from "~/domain/suggestions/types";

/** Writes replace the map, so unit-of-work snapshots are never mutated. Insertion order is creation order. */
export class MemorySuggestionRepository implements SuggestionRepository {
  private suggestions = new Map<string, Suggestion>();

  insert(suggestion: Suggestion): void {
    this.suggestions = new Map(this.suggestions).set(suggestion.id, suggestion);
  }

  get(id: string): Suggestion | undefined {
    return this.suggestions.get(id);
  }

  update(suggestion: Suggestion): void {
    this.insert(suggestion);
  }

  listPending(): Suggestion[] {
    return [...this.suggestions.values()].filter((s) => s.status === "pending");
  }

  snapshot(): Map<string, Suggestion> {
    return this.suggestions;
  }

  restore(snapshot: Map<string, Suggestion>): void {
    this.suggestions = snapshot;
  }
}
