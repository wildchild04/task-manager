export type BlockErrorCode =
  | "duplicate_id"
  | "not_found"
  | "validation"
  | "invalid_parent"
  | "invalid_position"
  | "invalid_type_change"
  | "cycle"
  | "protected";

/** A single operation broke a block-tree rule. */
export class BlockOperationError extends Error {
  constructor(
    readonly code: BlockErrorCode,
    message: string,
    /** For validation errors: the path of the offending field, e.g. `["props", "level"]`. */
    readonly path: readonly (string | number)[] = [],
  ) {
    super(message);
    this.name = "BlockOperationError";
  }
}

/** A batch was rejected; nothing in it was applied. */
export class BatchError extends Error {
  constructor(
    readonly index: number,
    readonly error: BlockOperationError,
  ) {
    super(`Operation ${index} rejected: ${error.message}`, { cause: error });
    this.name = "BatchError";
  }
}

/** The stored order of a parent's children is inconsistent. */
export class OrderIntegrityError extends Error {
  constructor(
    /** The parent whose children are inconsistent; `null` for the workspace root pages. */
    readonly parentId: string | null,
    detail: string,
  ) {
    super(`Order integrity error under ${parentId ?? "workspace root"}: ${detail}`);
    this.name = "OrderIntegrityError";
  }
}
