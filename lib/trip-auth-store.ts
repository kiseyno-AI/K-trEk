import type { StoredTripUser, TripAuthStore, TripUser } from './trip-auth';

export function createTripAuthStore(database: D1Database): TripAuthStore {
  return {
    findUser: (nameKey) =>
      database
        .prepare(
          'SELECT id,name,name_key,password_hash,role FROM trip_users WHERE name_key=?',
        )
        .bind(nameKey)
        .first<StoredTripUser>(),
    async createUser(user, now) {
      const result = await database
        .prepare(
          'INSERT OR IGNORE INTO trip_users(id,name,name_key,password_hash,role,created_at) VALUES(?,?,?,?,?,?)',
        )
        .bind(
          user.id,
          user.name,
          user.name_key,
          user.password_hash,
          user.role,
          now,
        )
        .run();
      return result.meta.changes === 1;
    },
    async setInitialPassword(userId, nameKey, passwordHash) {
      const result = await database
        .prepare(
          "UPDATE trip_users SET password_hash=? WHERE id=? AND name_key=? AND password_hash='' AND role='admin' AND name_key IN ('shawn','sun')",
        )
        .bind(passwordHash, userId, nameKey)
        .run();
      return result.meta.changes === 1;
    },
    async createSession(tokenHash, userId, expiresAt, now) {
      await database.batch([
        database
          .prepare('DELETE FROM trip_sessions WHERE expires_at<=?')
          .bind(now),
        database
          .prepare(
            'DELETE FROM trip_sessions WHERE user_id=? AND token_hash NOT IN (SELECT token_hash FROM trip_sessions WHERE user_id=? ORDER BY created_at DESC LIMIT 9)',
          )
          .bind(userId, userId),
        database
          .prepare(
            'INSERT INTO trip_sessions(token_hash,user_id,expires_at,created_at) VALUES(?,?,?,?)',
          )
          .bind(tokenHash, userId, expiresAt, now),
      ]);
    },
    sessionUser: (tokenHash, now) =>
      database
        .prepare(
          'SELECT u.id,u.name,u.role FROM trip_sessions s JOIN trip_users u ON u.id=s.user_id WHERE s.token_hash=? AND s.expires_at>?',
        )
        .bind(tokenHash, now)
        .first<TripUser>(),
    async revokeSession(tokenHash) {
      await database
        .prepare('DELETE FROM trip_sessions WHERE token_hash=?')
        .bind(tokenHash)
        .run();
    },
    async consumeLimit(keyHash, now, expiresAt) {
      await database
        .prepare('DELETE FROM trip_auth_limits WHERE expires_at<=?')
        .bind(now)
        .run();
      const row = await database
        .prepare(
          'INSERT INTO trip_auth_limits(key_hash,attempts,expires_at) VALUES(?,1,?) ON CONFLICT(key_hash) DO UPDATE SET attempts=trip_auth_limits.attempts+1 RETURNING attempts',
        )
        .bind(keyHash, expiresAt)
        .first<{ attempts: number }>();
      return row?.attempts ?? Number.MAX_SAFE_INTEGER;
    },
    async favorites(userId) {
      const result = await database
        .prepare(
          'SELECT f.activity_id FROM trip_favorites f JOIN activities a ON a.id=f.activity_id WHERE f.user_id=? AND a.published=1 ORDER BY f.created_at,f.activity_id',
        )
        .bind(userId)
        .all<{ activity_id: string }>();
      return result.results.map((row) => row.activity_id);
    },
    async setFavorite(userId, activityId, favorite, now) {
      const activity = await database
        .prepare('SELECT id FROM activities WHERE id=? AND published=1')
        .bind(activityId)
        .first();
      if (!activity) return false;
      if (favorite)
        await database
          .prepare(
            'INSERT OR IGNORE INTO trip_favorites(user_id,activity_id,created_at) SELECT ?,id,? FROM activities WHERE id=? AND published=1',
          )
          .bind(userId, now, activityId)
          .run();
      else
        await database
          .prepare(
            'DELETE FROM trip_favorites WHERE user_id=? AND activity_id=?',
          )
          .bind(userId, activityId)
          .run();
      return true;
    },
  };
}

export async function runtimeTripAuthStore(): Promise<TripAuthStore> {
  const { env } = await import('cloudflare:workers');
  const database = (env as { DB?: D1Database }).DB;
  if (!database) throw new Error('The account database is unavailable.');
  return createTripAuthStore(database);
}

export async function authenticateRequest(
  request: Pick<Request, 'url' | 'headers'>,
): Promise<TripUser | null> {
  const { authenticateWithStore } = await import('./trip-auth');
  return authenticateWithStore(request, await runtimeTripAuthStore());
}
