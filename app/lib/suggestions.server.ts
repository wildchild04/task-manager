import { z } from "zod";

import type { AppServices } from "~/composition";
import { SuggestionError } from "~/domain/suggestions/errors";

const decisionSchema = z.discriminatedUnion("intent", [
  z.object({ intent: z.enum(["approve", "reject", "reopen"]), id: z.string().min(1) }),
  z.object({ intent: z.enum(["approve-all", "reject-all"]), pageId: z.string().min(1) }),
]);

/** What a decision did: a message to show, and for a single approval or rejection, the suggestion to reopen on Undo. */
export type DecisionResult = { ok: true; message: string; undo?: string } | { ok: false; message: string };

const count = (n: number, what: string) => `${n} ${what}`;

/** Approves, rejects or reopens a suggestion, or approves or rejects all of a page's: what the review buttons send. */
export function decideSuggestion(services: AppServices, input: unknown): DecisionResult {
  const parsed = decisionSchema.safeParse(input);
  if (!parsed.success) return { ok: false, message: "The decision couldn't be read" };
  const decision = parsed.data;
  try {
    switch (decision.intent) {
      case "approve":
        services.suggestions.approve(decision.id);
        return { ok: true, message: "Suggestion approved", undo: decision.id };
      case "reject":
        services.suggestions.reject(decision.id);
        return { ok: true, message: "Suggestion rejected", undo: decision.id };
      case "reopen":
        services.suggestions.reopen(decision.id);
        return { ok: true, message: "Undone" };
      case "approve-all": {
        const { approved, outdated } = services.suggestions.approveAll(decision.pageId);
        return {
          ok: true,
          message: [count(approved, "approved"), ...(outdated ? [count(outdated, "outdated")] : [])].join(", "),
        };
      }
      case "reject-all":
        return { ok: true, message: count(services.suggestions.rejectAll(decision.pageId).rejected, "rejected") };
    }
  } catch (error) {
    if (error instanceof SuggestionError) return { ok: false, message: error.message };
    throw error;
  }
}
