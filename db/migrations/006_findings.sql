-- A finding is a comment record that holds an exploration's results.
ALTER TABLE comments ADD COLUMN kind TEXT NOT NULL DEFAULT 'comment' CHECK (kind IN ('comment', 'finding'));
