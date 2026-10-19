## Context

Content is a tree of typed blocks; a page's content is its children, and a task's description is an owned page. Humans edit pages in the browser: the editor keeps its own copy of the page's blocks and saves each edit as a batch of block operations, which the server accepts only if it stays inside the page (`checkPageEdit`). Agents work through the agent API: they read pages and descriptions as Markdown (no block IDs), and may only comment on and append to work tasks they hold. Single user, one SQLite database; SQLite transactions serialize writes.

This change lets agents propose changes anywhere without changing content themselves. The user named the shape: proposed blocks appear enclosed and highlighted where they'd apply, with Approve and Reject.

## Goals / Non-Goals

**Goals:**
- Agents propose inserts, replacements and deletions of blocks in any page or task description, at a precise place.
- A human sees each proposal in place and applies or discards it in one step, with a short undo.
- Agents working at once never conflict with each other or with the human while proposing; conflicts surface only at approval, as "outdated".
- Proposed content is not treated as content (backlinks, editing) until approved.

**Non-Goals:**
- Word-level tracked changes, human suggestions, editing a suggestion before approving it, page-level actions (create, delete, move, retitle), suggestions on comments or project home pages. See the proposal.

## Decisions

### 1. A suggestion is a block in the tree plus a record

The suggestion is a `suggestion` block placed where it would apply, whose children are the proposed blocks; a `suggestions` table holds what isn't content: author, note, action, target, the target's state when proposed, status, and who resolved it.

- The block gives position, order, nesting, rendering and loading for free: `loadTree` already returns it with the page, and the viewer and editor render it like any other container.
- The record outlives the block: after approval or rejection the block is gone but agents can still ask what happened (`GET suggestion/:id`), and undo has what it needs.
- The record's ID is the block's ID.

*Alternatives:* an overlay store of differences keyed by anchor blocks (no tree change, but every renderer must merge two sources, and the position is lost when the anchor moves or is deleted); a block only, with status in props (status disappears with the block on approval).

Block props: `{ action: "insert" | "replace" | "delete", targetId?: string }` (`targetId` required for replace and delete). Insert and replace have at least one child; delete has none. A suggestion can't contain `page`, `comment` or `suggestion` blocks.

### 2. Placement

- **insert**: after a block (same parent), as the last child of a block, or at the end of the page. The approved blocks take the suggestion's place.
- **replace** / **delete**: the suggestion is placed right after its target, in the same parent. Approving puts the replacement blocks at the *target's* position (wherever it is then) and removes the target; the target's children move under the first replacement block (a replace is of one block, not its subtree). Delete removes the target and its subtree.
- Targets and positions must be in the page's own content: not in a sub-page's content, not inside a suggestion, not a sub-page or a suggestion themselves.

Rendering: a pending replace or delete shows a struck-through copy of the target's current content inside the box ("Replaces" / "Deletes"), and the target itself carries a yellow marker at its position. The box stays where it was placed even if the target moves later.

### 3. Outdated is computed, not stored

When proposed, the record stores the target's `base`: its type, props and content (for delete, its whole subtree). A pending replace or delete is **outdated** when its target no longer exists or no longer equals `base`. It is computed on read, so it is always current and needs no hook on every edit. Approving re-checks it inside the same transaction. An outdated suggestion can only be rejected.

*Alternative:* compare an updated-at timestamp. Rejected: a save that writes the same content would mark suggestions outdated for nothing, and blocks have no version column.

Inserts are never outdated: the place they go still exists, or it was deleted, and deleting a block that holds a suggestion is refused (decision 6).

### 4. Approve and reject are domain operations, not edit batches

`SuggestionService.approve(id)`, `.reject(id)` and `.reopen(id)` each build one block batch and update the record in one transaction. The browser calls them through their own route actions, not through the page's edit batches.

- The rules (staleness, where blocks go, what a suggestion may contain) live in one tested service, the same one the agent API uses to create suggestions.
- Edit batches can't forge an approval: `checkPageEdit` refuses any batch that touches a suggestion (decision 6), so the only way to apply one is `approve`.

Approve all and reject all apply to the pending suggestions of one page, in document order, in one transaction. Outdated suggestions are skipped by approve all and reported ("2 approved, 1 outdated").

### 5. Undo through the record, offered right after

On approve or reject, the record keeps a `snapshot` of what the batch removed (the suggestion subtree, and for replace and delete the target subtree) and the IDs it moved. `reopen(id)` restores the page to its state before the resolution and sets the record back to pending. It is offered as **Undo** in the confirmation shown after approving or rejecting, until the next edit on that page. That guarantees nothing moved in between: agents only add suggestions, never change content.

*Alternative:* put approve and reject in the editor's Cmd+Z history. The history replays block batches the editor computed itself; a server-computed resolution would need a second kind of history entry and a way to invert a batch the client never saw. That can come later; a toast undo covers the mistake case.

After a resolution, the editor first flushes its pending saves, then calls the action, then reloads the page's blocks into its state, as it already does when a save is rejected.

### 6. The editor treats suggestions as one closed unit

- In `block-types.ts`, `suggestion` is non-text and can't take children *from the editor*: the caret skips it as it skips dividers and sub-pages, Tab can't nest into it, and Backspace after it moves the caret to the previous text block without deleting it.
- `checkPageEdit` refuses a batch that inserts a `suggestion`, or inserts, updates, moves or deletes a suggestion or any block inside one. It also refuses deleting a block that *contains* a suggestion ("Approve or reject the suggestion inside first"), as it already does for sub-pages. Moving such a block is allowed. Deleting or editing a suggestion's *target* is allowed and makes the suggestion outdated.

### 7. Anchors in the Markdown agents read

`read_page` and `read_description` take `anchors: true`, which appends ` ^1a2b3c4d` (the block's 8-character ID) to the first line of every block. That is Obsidian's block-reference syntax: compact, on the line it names, and familiar to models. The importer drops a trailing ` ^xxxxxxxx` from any line, so Markdown copied back with anchors doesn't add them as text.

*Alternatives:* heading paths ("## Glossary > 2nd bullet"), which are ambiguous and break on renames; a separate JSON block list, which roughly doubles the response size.

### 8. Suggestions in the Markdown agents read

Pending suggestions are written as a tag line around their blocks:

```
<suggestion id="1a2b3c4d" by="builder" action="replace" target="9f8e7d6c" status="outdated" note="Fix the date">
- New bullet text
</suggestion>
```

Markdown has no container syntax models reliably know; a tag is unambiguous, can't occur in content written through the API (the importer refuses `<suggestion` lines), and lets agents see each other's pending work so they don't propose the same change twice.

### 9. Agent API

- `POST suggest` with `{ page | task, action, after? | inside?, target?, markdown?, note? }` returns `{ ok, id }`. `page` is a page ID (as for `read_page`), `task` a task ID (its description). Positions and targets are resolved by short ID *within that page's own content*.
- `GET suggestion/:id` returns `{ id, action, status, place, resolvedAt? }`, where `place` is `page:<id>` or `task:<id>`.
- `POST suggestion/:id/withdraw` takes back the calling agent's own pending (or outdated) suggestion: the same removal as `reject`, recorded as `withdrawn`. Another agent's suggestion is `forbidden`. Withdrawing has no undo; the agent can suggest again.
- Agents may suggest on any page or task, including work held by another agent: suggestions don't change content, so claiming doesn't apply.

### 10. Pending content isn't content

- Backlinks: `pageBacklinks` skips mention and reference sources that have a suggestion ancestor. Walking up the parents per source is cheap at this scale.
- Task `references` relations are explicit relations, not derived from blocks, so they're unaffected. The low-level listings (`listMentioning`, `listIncomingReferences`) stay raw; only the "Mentioned in" views filter.
- The page and task search is title-only, and suggestions can't contain pages, so search is unaffected.

### 11. Review list on the home dashboard

A "Waiting for review" section lists each page or task with pending suggestions: its title and place, the count, and the agents, oldest suggestion first. Read straight from the `suggestions` table (`status = 'pending'`), grouped by place. It is an ADDED requirement, so it doesn't conflict with `home-dashboard`'s changes to the home route.

### 12. Storage

Migration `005_suggestions.sql`: `suggestions (id PK, place_page_id, action, target_id, note, actor_name, base JSON, status CHECK IN ('pending','approved','rejected','withdrawn'), snapshot JSON, created_at, resolved_at)`, indexed on `(status, place_page_id)`. `place_page_id` is the page whose own content holds the suggestion (a workspace page, a library document or a task's body page). It has an in-memory twin with the shared repository contract, as every repository does. Suggestions are only created by agents, so the author is always an agent and its name is required. The human resolver needs no name in a single-user app.

## Risks / Trade-offs

- [Deleting a block that holds a suggestion is refused] → The message says why. Approve or reject first, as for sub-pages. Most suggestions sit at the top level, so this is rare.
- [A replace swaps whole blocks: a one-word fix shows the whole paragraph twice] → Acceptable for the first version. The box shows old and new together, so the change is easy to spot. Word-level differences can come later.
- [Undo only until the next edit] → Covers the misclick. After that, the approved content is ordinary blocks to edit, and a rejected suggestion's record (with its snapshot) still exists if restoring is ever needed.
- [Spam: an agent proposes dozens of suggestions on one page] → Reject all clears a page in one step. A per-page cap can be added if it happens.
- [The editor reloads its blocks after a resolution] → It flushes pending saves first. Caret position is kept when its block still exists.
- [Markdown readers that aren't ours see `<suggestion>` tags] → Only agent reads include them. Exports for humans, if they come, render approved content only.

## Migration Plan

Additive: a new table and a new block type, and existing blocks are unaffected. Deploy the app, then reconnect the MCP server so it gets the new tools. Rollback: older code would hit unknown `suggestion` blocks, so reject (or approve) all pending suggestions before rolling back.

## Open Questions

- **Revising a suggestion before approving it**: the human edits the proposed blocks, or leaves inline comments on them that the author agent picks up and answers with an updated suggestion. Moved to the exploration "Revising suggestions before approval"; nothing in this change should make either harder (the record already ties a suggestion to its author).
