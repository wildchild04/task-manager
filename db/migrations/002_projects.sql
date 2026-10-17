CREATE TABLE projects (
  id TEXT PRIMARY KEY,
  -- Owned root pages (owner project:<id>). The title is the home page's title.
  home_page_id TEXT NOT NULL UNIQUE,
  library_root_id TEXT NOT NULL UNIQUE,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);

CREATE INDEX projects_created ON projects (created_at);
