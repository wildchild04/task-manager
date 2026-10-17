CREATE TABLE blocks (
  id TEXT PRIMARY KEY,
  type TEXT NOT NULL,
  -- NULL for roots. Order among siblings is a linked list: prev_id is the
  -- sibling directly before this one, NULL for the first.
  parent_id TEXT,
  prev_id TEXT,
  -- Set only on owned roots (task body pages, project pages, comment bodies).
  owner_kind TEXT,
  owner_id TEXT,
  props TEXT NOT NULL DEFAULT '{}',
  content TEXT NOT NULL DEFAULT '[]',
  -- Mirrors props.targetId of reference blocks, for backlink queries. No
  -- foreign key: a reference outlives its target and resolves as missing.
  target_id TEXT,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  CHECK ((owner_kind IS NULL) = (owner_id IS NULL)),
  CHECK (owner_kind IS NULL OR (parent_id IS NULL AND prev_id IS NULL))
);

-- At most one block per (parent, previous sibling): rejects forks and second
-- heads. Owned roots are unordered, so they are excluded.
CREATE UNIQUE INDEX blocks_sibling_order
  ON blocks (COALESCE(parent_id, ''), COALESCE(prev_id, ''))
  WHERE owner_kind IS NULL;

CREATE INDEX blocks_parent ON blocks (parent_id);
CREATE INDEX blocks_owner ON blocks (owner_kind, owner_id) WHERE owner_kind IS NOT NULL;
CREATE INDEX blocks_target ON blocks (target_id) WHERE target_id IS NOT NULL;
