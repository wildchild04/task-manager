CREATE TABLE suggestions (
  -- Also the ID of the `suggestion` block holding the proposed blocks while it's pending.
  id TEXT PRIMARY KEY,
  -- The page whose own content holds the suggestion.
  page_id TEXT NOT NULL,
  action TEXT NOT NULL CHECK (action IN ('insert', 'replace', 'delete')),
  target_id TEXT,
  note TEXT,
  actor_name TEXT NOT NULL,
  -- JSON: the target when suggested, to tell when it changed.
  base TEXT,
  status TEXT NOT NULL CHECK (status IN ('pending', 'approved', 'rejected', 'withdrawn')),
  -- JSON batch putting the page back as it was before the resolution.
  undo TEXT,
  created_at TEXT NOT NULL,
  resolved_at TEXT,
  CHECK ((action = 'insert') = (target_id IS NULL))
);

CREATE INDEX suggestions_pending ON suggestions (status, created_at);
