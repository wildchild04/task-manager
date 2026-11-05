-- Feedback on suggestions: the human asks an agent for changes, and the agent revises the same suggestion.
-- Each revision increases `revision`; feedback is open while it was given on the suggestion's current revision.
ALTER TABLE suggestions ADD COLUMN revision INTEGER NOT NULL DEFAULT 1;
ALTER TABLE suggestions ADD COLUMN revised_at TEXT;

CREATE TABLE suggestion_feedback (
  id TEXT PRIMARY KEY,
  suggestion_id TEXT NOT NULL REFERENCES suggestions (id),
  -- Plain text, trimmed, 1 to 2,000 characters.
  text TEXT NOT NULL,
  -- The suggestion's revision when the feedback was given.
  revision INTEGER NOT NULL,
  created_at TEXT NOT NULL
);

CREATE INDEX suggestion_feedback_by_suggestion ON suggestion_feedback (suggestion_id, created_at);
