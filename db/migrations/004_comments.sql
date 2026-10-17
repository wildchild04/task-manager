CREATE TABLE comments (
  id TEXT PRIMARY KEY,
  task_id TEXT NOT NULL REFERENCES tasks (id),
  -- Owned root `comment` block (owner comment:<id>); its children are the content.
  body_block_id TEXT NOT NULL UNIQUE,
  actor_kind TEXT NOT NULL CHECK (actor_kind IN ('human', 'agent')),
  actor_name TEXT,
  created_at TEXT NOT NULL,
  edited_at TEXT,
  CHECK ((actor_kind = 'agent') = (actor_name IS NOT NULL))
);

CREATE INDEX comments_task ON comments (task_id, created_at);
