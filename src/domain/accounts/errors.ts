export type AccountErrorCode = "validation" | "exists" | "not_found" | "wrong_password" | "unavailable";

export class AccountError extends Error {
  constructor(
    readonly code: AccountErrorCode,
    message: string,
    /** The form field the error belongs to, when there is one. */
    readonly field?: string,
  ) {
    super(message);
    this.name = "AccountError";
  }
}
