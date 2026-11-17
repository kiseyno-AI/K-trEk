CREATE TABLE IF NOT EXISTS trip_member_preferences (
  user_id TEXT PRIMARY KEY NOT NULL REFERENCES trip_users(id) ON DELETE CASCADE,
  category_ids TEXT NOT NULL DEFAULT '[]' CHECK (json_valid(category_ids) AND json_type(category_ids)='array' AND json_array_length(category_ids)<=8),
  draft_vote_ids TEXT NOT NULL DEFAULT '[]' CHECK (json_valid(draft_vote_ids) AND json_type(draft_vote_ids)='array' AND json_array_length(draft_vote_ids)<=20),
  submitted_vote_ids TEXT NOT NULL DEFAULT '[]' CHECK (json_valid(submitted_vote_ids) AND json_type(submitted_vote_ids)='array' AND json_array_length(submitted_vote_ids)<=20),
  updated_at INTEGER NOT NULL
) STRICT;

CREATE TABLE IF NOT EXISTS trip_reports (
  id TEXT PRIMARY KEY NOT NULL,
  user_id TEXT NOT NULL REFERENCES trip_users(id) ON DELETE CASCADE,
  message TEXT NOT NULL CHECK (length(trim(message)) BETWEEN 1 AND 2000),
  created_at INTEGER NOT NULL,
  read_at INTEGER
) STRICT;
CREATE INDEX IF NOT EXISTS trip_reports_unread_created ON trip_reports(read_at,created_at DESC);
CREATE INDEX IF NOT EXISTS trip_reports_user_created ON trip_reports(user_id,created_at DESC);
