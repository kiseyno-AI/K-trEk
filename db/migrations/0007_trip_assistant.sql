CREATE TABLE IF NOT EXISTS trip_assistant_sessions (
  user_id TEXT NOT NULL REFERENCES trip_users(id) ON DELETE CASCADE,
  session_id TEXT NOT NULL,
  started_at INTEGER NOT NULL,
  last_event_at INTEGER NOT NULL,
  active_seconds INTEGER NOT NULL DEFAULT 0 CHECK (active_seconds BETWEEN 0 AND 86400),
  last_proactive_at INTEGER,
  triggered_patterns TEXT NOT NULL DEFAULT '[]' CHECK (json_valid(triggered_patterns) AND json_type(triggered_patterns)='array'),
  PRIMARY KEY (user_id,session_id)
) STRICT;
CREATE TABLE IF NOT EXISTS trip_assistant_events (
  user_id TEXT NOT NULL,
  session_id TEXT NOT NULL,
  event_id TEXT NOT NULL,
  event TEXT NOT NULL CHECK (event IN ('card_open','session_tick','favorite_added','vote_added')),
  activity_id TEXT REFERENCES activities(id) ON DELETE SET NULL,
  elapsed_seconds INTEGER NOT NULL CHECK (elapsed_seconds BETWEEN 0 AND 86400),
  created_at INTEGER NOT NULL,
  PRIMARY KEY (user_id,session_id,event_id),
  FOREIGN KEY (user_id,session_id) REFERENCES trip_assistant_sessions(user_id,session_id) ON DELETE CASCADE
) STRICT;
CREATE INDEX IF NOT EXISTS trip_assistant_events_card ON trip_assistant_events(user_id,session_id,event,created_at DESC);
CREATE TABLE IF NOT EXISTS trip_assistant_messages (
  id TEXT PRIMARY KEY NOT NULL,
  user_id TEXT NOT NULL,
  session_id TEXT NOT NULL,
  text TEXT NOT NULL CHECK (length(text) BETWEEN 1 AND 1200),
  sources TEXT NOT NULL CHECK (json_valid(sources) AND json_type(sources)='array' AND json_array_length(sources)<=6),
  report_draft TEXT CHECK (report_draft IS NULL OR length(report_draft)<=2000),
  trigger TEXT NOT NULL CHECK (trigger IN ('chat','comparison','repeat','hour')),
  created_at INTEGER NOT NULL,
  heard_at INTEGER,
  FOREIGN KEY (user_id,session_id) REFERENCES trip_assistant_sessions(user_id,session_id) ON DELETE CASCADE
) STRICT;
CREATE INDEX IF NOT EXISTS trip_assistant_messages_owner ON trip_assistant_messages(user_id,created_at DESC);
