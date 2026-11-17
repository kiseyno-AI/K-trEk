CREATE TABLE IF NOT EXISTS trip_users (
  id TEXT PRIMARY KEY NOT NULL,
  name TEXT NOT NULL CHECK (length(name) BETWEEN 1 AND 40),
  name_key TEXT NOT NULL UNIQUE,
  password_hash TEXT NOT NULL,
  role TEXT NOT NULL DEFAULT 'member' CHECK (role IN ('member', 'admin')),
  created_at INTEGER NOT NULL,
  CHECK ((name_key IN ('shawn', 'sun')) = (role = 'admin'))
) STRICT;

CREATE TABLE IF NOT EXISTS trip_sessions (
  token_hash TEXT PRIMARY KEY NOT NULL CHECK (length(token_hash) = 64),
  user_id TEXT NOT NULL REFERENCES trip_users(id) ON DELETE CASCADE,
  expires_at INTEGER NOT NULL,
  created_at INTEGER NOT NULL
) STRICT;
CREATE INDEX IF NOT EXISTS trip_sessions_user ON trip_sessions(user_id, created_at);
CREATE INDEX IF NOT EXISTS trip_sessions_expiry ON trip_sessions(expires_at);

CREATE TABLE IF NOT EXISTS trip_favorites (
  user_id TEXT NOT NULL REFERENCES trip_users(id) ON DELETE CASCADE,
  activity_id TEXT NOT NULL REFERENCES activities(id) ON DELETE CASCADE,
  created_at INTEGER NOT NULL,
  PRIMARY KEY (user_id, activity_id)
) STRICT;

CREATE TABLE IF NOT EXISTS trip_auth_limits (
  key_hash TEXT PRIMARY KEY NOT NULL,
  attempts INTEGER NOT NULL,
  expires_at INTEGER NOT NULL
) STRICT;
CREATE INDEX IF NOT EXISTS trip_auth_limits_expiry ON trip_auth_limits(expires_at);
