CREATE TABLE tasks (
  id TEXT PRIMARY KEY,
  project_id TEXT NOT NULL REFERENCES projects (id),
  kind TEXT NOT NULL,
  state TEXT NOT NULL,
  -- Owned root page (owner task:<id>). The title is the body page's title.
  body_page_id TEXT NOT NULL UNIQUE,
  attributes TEXT NOT NULL DEFAULT '{}',
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);

CREATE INDEX tasks_project_kind_state ON tasks (project_id, kind, state);

-- Append-only: rows are never updated or deleted.
CREATE TABLE task_transitions (
  id TEXT PRIMARY KEY,
  task_id TEXT NOT NULL REFERENCES tasks (id),
  name TEXT NOT NULL,
  from_state TEXT NOT NULL,
  to_state TEXT NOT NULL,
  actor_kind TEXT NOT NULL CHECK (actor_kind IN ('human', 'agent')),
  actor_name TEXT,
  note TEXT,
  at TEXT NOT NULL,
  CHECK ((actor_kind = 'agent') = (actor_name IS NOT NULL))
);

CREATE INDEX task_transitions_task ON task_transitions (task_id, at);

CREATE TABLE task_relations (
  id TEXT PRIMARY KEY,
  type TEXT NOT NULL CHECK (type IN ('born_from', 'iterates_on', 'references')),
  from_task_id TEXT NOT NULL REFERENCES tasks (id),
  -- A registered referenceable kind (task, block, ...). No foreign key: a
  -- referenced block can be deleted and then resolves as missing.
  to_kind TEXT NOT NULL,
  to_id TEXT NOT NULL,
  created_at TEXT NOT NULL,
  UNIQUE (from_task_id, type, to_kind, to_id)
);

CREATE INDEX task_relations_from ON task_relations (from_task_id, type);
CREATE INDEX task_relations_to ON task_relations (to_kind, to_id, type);
