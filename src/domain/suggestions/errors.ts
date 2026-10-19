export type SuggestionErrorCode = "not_found" | "validation" | "outdated" | "resolved" | "forbidden";

export class SuggestionError extends Error {
  constructor(
    readonly code: SuggestionErrorCode,
    message: string,
  ) {
    super(message);
    this.name = "SuggestionError";
  }
}
