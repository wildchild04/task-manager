import { z } from "zod";

import type { AppServices } from "~/composition";
import { SuggestionError } from "~/domain/suggestions/errors";

import { deletionRedirect } from "./action-suggestions.server";

const decisionSchema = z.discriminatedUnion("intent", [
  z.object({ intent: z.enum(["approve", "reject", "reopen"]), id: z.string().min(1) }),
  z.object({ intent: z.enum(["approve-all", "reject-all"]), pageId: z.string().min(1) }),
  z.object({ intent: z.literal("request-changes"), id: z.string().min(1), text: z.string() }),
]);

/**
 * What a decision did: a message to show; for a single approval or rejection of a block suggestion, the
 * suggestion to reopen on Undo; after an approved deletion, where to go now that the subject is gone.
 */
export type DecisionResult = { ok: true; message: string; undo?: string; redirectTo?: string } | { ok: false; message: string };

const count = (n: number, what: string) => `${n} ${what}`;

/**
 * Approves, rejects or reopens a suggestion, asks its agent for changes, or approves or rejects all of a
 * page's: what the review buttons send.
 */
export function decideSuggestion(services: AppServices, input: unknown): DecisionResult {
  const parsed = decisionSchema.safeParse(input);
  if (!parsed.success) return { ok: false, message: "The decision couldn't be read" };
  const decision = parsed.data;
  try {
    switch (decision.intent) {
      case "approve": {
        const subject = services.suggestions.get(decision.id)?.subject;
        if (subject) {
          const deleting = services.suggestions.get(decision.id)!.action === "delete";
          const redirectTo = deleting ? deletionRedirect(services, subject) : undefined;
          services.suggestions.approve(decision.id);
          return { ok: true, message: "Suggestion approved", ...(redirectTo ? { redirectTo } : {}) };
        }
        services.suggestions.approve(decision.id);
        return { ok: true, message: "Suggestion approved", undo: decision.id };
      }
      case "reject": {
        const action = services.suggestions.get(decision.id)?.subject;
        services.suggestions.reject(decision.id);
        return { ok: true, message: "Suggestion rejected", ...(action ? {} : { undo: decision.id }) };
      }
      case "reopen":
        services.suggestions.reopen(decision.id);
        return { ok: true, message: "Undone" };
      case "approve-all": {
        const { approved, outdated, waiting } = services.suggestions.approveAll(decision.pageId);
        return {
          ok: true,
          message: [
            count(approved, "approved"),
            ...(outdated ? [count(outdated, "outdated")] : []),
            ...(waiting ? [count(waiting, "waiting for changes")] : []),
          ].join(", "),
        };
      }
      case "request-changes":
        services.suggestions.requestChanges(decision.id, decision.text);
        return { ok: true, message: "Changes requested" };
      case "reject-all":
        return { ok: true, message: count(services.suggestions.rejectAll(decision.pageId).rejected, "rejected") };
    }
  } catch (error) {
    if (error instanceof SuggestionError) return { ok: false, message: error.message };
    throw error;
  }
}
