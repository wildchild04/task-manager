## Context

Reference blocks store their target in a `target_id` column, and `BlockRepository.listIncomingReferences` already lists them. Mentions (since `inline-page-mentions`) live inside the `content` JSON as spans with `mention.pageId`. `app/lib/links.server.ts` already maps any block to where it is shown (a task page, a comment anchor, or the nearest page).

## Decisions

### 1. `listMentioning(pageId)` in the repository port
SQLite: `SELECT * FROM blocks b WHERE EXISTS (SELECT 1 FROM json_each(b.content) j WHERE json_extract(j.value, '$.mention.pageId') = ?)`. Exact (no false matches from text that happens to contain the ID), no index: a single user's workspace is small, and the page view runs it once. Memory: scan rows. Both return each block once.

**Alternative considered:** a `block_mentions` table maintained on every write. Faster, but it adds a migration and write-path bookkeeping that the current scale doesn't need; it can come later behind the same port.

### 2. Places, not blocks
`pageBacklinks(services, pageId)` collects mentioning blocks and incoming reference blocks, maps each to its place with the same rules as reference links: a block in a task's body → that task; otherwise the nearest containing page (only browsable pages; comments and other owned roots are skipped). Blocks inside the page itself are dropped. Places are grouped with a count, ordered by kind (pages, then tasks) and title.

### 3. Shown on the page route
The page loader adds `backlinks`; a "Mentioned in" card under the content lists them as links (task entries with a kind chip). Server-rendered like the rest of the page, so it's current on every load and after the shell revalidates.

## Risks / Trade-offs

- [Full-table JSON scan per page view] → acceptable at single-user scale; the port allows an index table later.
