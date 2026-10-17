import { BatchError } from "~/domain/blocks/errors";
import { ProjectError } from "~/domain/projects/project.service";
import { TaskError } from "~/domain/tasks/errors";

export type FieldErrors = Record<string, string>;

/** What a create action returns: success, or the errors and the submitted values to show again. */
export type ActionResult =
  | { ok: true; id: string }
  | { ok: false; fieldErrors: FieldErrors; formError?: string; values: Record<string, string> };

/** The submitted text fields, trimmed. */
export function formValues(formData: FormData): Record<string, string> {
  const values: Record<string, string> = {};
  for (const [key, value] of formData) if (typeof value === "string") values[key] = value.trim();
  return values;
}

export const invalid = (values: Record<string, string>, fieldErrors: FieldErrors, formError?: string): ActionResult => ({
  ok: false,
  fieldErrors,
  values,
  ...(formError ? { formError } : {}),
});

/**
 * Turns a domain rejection into a form error. Validation problems are shown
 * on `field`; anything that isn't a domain error is a bug and is rethrown.
 */
export function domainError(error: unknown, values: Record<string, string>, field = "title"): ActionResult {
  if (error instanceof TaskError || error instanceof ProjectError) {
    return error.code === "validation" ? invalid(values, { [field]: error.message }) : invalid(values, {}, error.message);
  }
  if (error instanceof BatchError) return invalid(values, {}, error.error.message);
  throw error;
}
