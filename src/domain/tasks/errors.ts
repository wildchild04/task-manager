export type TaskErrorCode =
  | "not_found"
  | "duplicate_id"
  | "validation"
  | "invalid_transition"
  | "invalid_relation";

export class TaskError extends Error {
  constructor(
    readonly code: TaskErrorCode,
    message: string,
  ) {
    super(message);
    this.name = "TaskError";
  }
}
