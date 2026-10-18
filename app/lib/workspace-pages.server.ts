import type { AppServices } from "~/composition";
import { BatchError } from "~/domain/blocks/errors";

import { type ActionResult, formValues, invalid } from "./forms.server";

/** Creates a top-level workspace page from the `title` field, after the existing ones. */
export function createWorkspacePageAction(services: AppServices, formData: FormData): ActionResult {
  const values = formValues(formData);
  if (!values.title) return invalid(values, { title: "A page needs a title" });
  const id = crypto.randomUUID();
  const afterId = services.blocks.listRootPages().at(-1)?.id ?? null;
  try {
    services.blocks.apply([{ op: "insert", block: { id, type: "page", content: [{ text: values.title }] }, parentId: null, afterId }]);
  } catch (error) {
    if (error instanceof BatchError) return invalid(values, {}, error.error.message);
    throw error;
  }
  return { ok: true, id };
}
