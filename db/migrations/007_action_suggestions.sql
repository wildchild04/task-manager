-- Action suggestions: an agent proposes acting on a project, page or task (rename, delete, schedule, transition)
-- rather than changing blocks. SQLite can't change a CHECK, so the table is rebuilt with every row kept.
CREATE TABLE suggestions_new (
  -- A block suggestion's ID is also the ID of the `suggestion` block holding the proposed blocks while it's pending.
  id TEXT PRIMARY KEY,
  -- The page whose own content holds a block suggestion; for an action, the subject's place page
  -- (a project's home page, the page itself, a task's body page).
  page_id TEXT NOT NULL,
  action TEXT NOT NULL CHECK (action IN ('insert', 'replace', 'delete', 'rename', 'schedule', 'transition')),
  target_id TEXT,
  -- What an action acts on; null for block suggestions.
  subject_kind TEXT CHECK (subject_kind IN ('project', 'page', 'task')),
  subject_id TEXT,
  -- JSON: what an action proposes (the title, the schedule, the transition).
  payload TEXT,
  note TEXT,
  actor_name TEXT NOT NULL,
  -- JSON: the target (or the subject) when suggested, to tell when it changed.
  base TEXT,
  status TEXT NOT NULL CHECK (status IN ('pending', 'approved', 'rejected', 'withdrawn')),
  -- JSON batch putting the page back as it was before the resolution (block suggestions only).
  undo TEXT,
  created_at TEXT NOT NULL,
  resolved_at TEXT,
  CHECK ((subject_kind IS NULL) = (subject_id IS NULL)),
  CHECK (action NOT IN ('rename', 'schedule', 'transition') OR subject_kind IS NOT NULL),
  CHECK (subject_kind IS NULL OR target_id IS NULL),
  CHECK (subject_kind IS NOT NULL OR (action = 'insert') = (target_id IS NULL))
);

INSERT INTO suggestions_new (id, page_id, action, target_id, note, actor_name, base, status, undo, created_at, resolved_at)
  SELECT id, page_id, action, target_id, note, actor_name, base, status, undo, created_at, resolved_at FROM suggestions;

DROP TABLE suggestions;
ALTER TABLE suggestions_new RENAME TO suggestions;

CREATE INDEX suggestions_pending ON suggestions (status, created_at);
