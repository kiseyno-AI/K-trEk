import { createTripAuthStore, authenticateRequest } from './trip-auth-store.ts';
import {
  createTripCommunityHandlers,
  type TripCommunityStore,
  type TripPreferenceInput,
  type HostReviews,
  type TripReport,
  type TripMember,
} from './trip-community.ts';

function list(value: unknown): string[] {
  const parsed: unknown = typeof value === 'string' ? JSON.parse(value) : [];
  if (!Array.isArray(parsed) || parsed.some((id) => typeof id !== 'string'))
    throw new Error('Invalid stored preferences.');
  return parsed as string[];
}
export function createTripCommunityStore(
  database: D1Database,
): TripCommunityStore {
  const auth = createTripAuthStore(database);
  const publishedIds = async () => {
    const result = await database
      .prepare('SELECT id FROM activities WHERE published=1')
      .all<{ id: string }>();
    return result.results.map((row) => row.id);
  };
  const preferences = async (userId: string) => {
    const row = await database
      .prepare(
        'SELECT category_ids,draft_vote_ids,submitted_vote_ids,updated_at FROM trip_member_preferences WHERE user_id=?',
      )
      .bind(userId)
      .first<{
        category_ids: string;
        draft_vote_ids: string;
        submitted_vote_ids: string;
        updated_at: number;
      }>();
    if (!row)
      return {
        categoryIds: [],
        draftVoteIds: [],
        submittedVoteIds: [],
        updatedAt: null,
      };
    const published = new Set(await publishedIds());
    return {
      categoryIds: list(row.category_ids),
      draftVoteIds: list(row.draft_vote_ids).filter((id) => published.has(id)),
      submittedVoteIds: list(row.submitted_vote_ids).filter((id) =>
        published.has(id),
      ),
      updatedAt: row.updated_at,
    };
  };
  return {
    publishedIds,
    preferences,
    async savePreferences(userId, input: TripPreferenceInput, now) {
      await database
        .prepare(
          'INSERT INTO trip_member_preferences(user_id,category_ids,draft_vote_ids,submitted_vote_ids,updated_at) VALUES(?,?,?,?,?) ON CONFLICT(user_id) DO UPDATE SET category_ids=excluded.category_ids,draft_vote_ids=excluded.draft_vote_ids,submitted_vote_ids=excluded.submitted_vote_ids,updated_at=excluded.updated_at',
        )
        .bind(
          userId,
          JSON.stringify(input.categoryIds),
          JSON.stringify(input.draftVoteIds),
          JSON.stringify(input.submittedVoteIds),
          now,
        )
        .run();
    },
    async members() {
      const [users, prefs, favorites, published] = await Promise.all([
        database
          .prepare(
            'SELECT id,name,role,created_at AS createdAt FROM trip_users ORDER BY created_at,id',
          )
          .all<Pick<TripMember, 'id' | 'name' | 'role' | 'createdAt'>>(),
        database
          .prepare(
            'SELECT user_id,category_ids,draft_vote_ids,submitted_vote_ids FROM trip_member_preferences',
          )
          .all<{
            user_id: string;
            category_ids: string;
            draft_vote_ids: string;
            submitted_vote_ids: string;
          }>(),
        database
          .prepare(
            'SELECT f.user_id,f.activity_id FROM trip_favorites f JOIN activities a ON a.id=f.activity_id WHERE a.published=1 ORDER BY f.created_at,f.activity_id',
          )
          .all<{ user_id: string; activity_id: string }>(),
        publishedIds(),
      ]);
      const visible = new Set(published);
      const preferencesByUser = new Map(
        prefs.results.map((row) => [row.user_id, row]),
      );
      const favoritesByUser = new Map<string, string[]>();
      for (const row of favorites.results) {
        const ids = favoritesByUser.get(row.user_id) ?? [];
        ids.push(row.activity_id);
        favoritesByUser.set(row.user_id, ids);
      }
      return users.results.map((user) => {
        const pref = preferencesByUser.get(user.id);
        return {
          ...user,
          categoryIds: pref ? list(pref.category_ids) : [],
          draftVoteIds: pref
            ? list(pref.draft_vote_ids).filter((id) => visible.has(id))
            : [],
          submittedVoteIds: pref
            ? list(pref.submitted_vote_ids).filter((id) => visible.has(id))
            : [],
          favoriteIds: favoritesByUser.get(user.id) ?? [],
        };
      });
    },
    async reports() {
      const result = await database
        .prepare(
          'SELECT r.id,r.user_id AS userId,u.name AS memberName,r.message,r.created_at AS createdAt,r.read_at AS readAt FROM trip_reports r JOIN trip_users u ON u.id=r.user_id ORDER BY (r.read_at IS NOT NULL),r.created_at DESC,r.id DESC LIMIT 200',
        )
        .all<TripReport>();
      return result.results;
    },
    async createReport(id, userId, message, now) {
      await database
        .prepare(
          'INSERT INTO trip_reports(id,user_id,message,created_at) VALUES(?,?,?,?)',
        )
        .bind(id, userId, message, now)
        .run();
      const report = await database
        .prepare(
          'SELECT r.id,r.user_id AS userId,u.name AS memberName,r.message,r.created_at AS createdAt,r.read_at AS readAt FROM trip_reports r JOIN trip_users u ON u.id=r.user_id WHERE r.id=?',
        )
        .bind(id)
        .first<TripReport>();
      if (!report) throw new Error('The report could not be saved.');
      return report;
    },
    async markReportsRead(ids, now) {
      if (ids.length === 0) return;
      await database
        .prepare(
          `UPDATE trip_reports SET read_at=COALESCE(read_at,?) WHERE id IN(${ids.map(() => '?').join(',')})`,
        )
        .bind(now, ...ids)
        .run();
    },
    async updateReviews(id, reviews: HostReviews) {
      await database
        .prepare(
          "UPDATE activities SET shawn_comment=?,sun_comment=?,shawn_rating=?,sun_rating=?,updated_at=strftime('%Y-%m-%dT%H:%M:%fZ','now') WHERE id=? AND published=1",
        )
        .bind(
          reviews.shawn_comment,
          reviews.sun_comment,
          reviews.shawn_rating,
          reviews.sun_rating,
          id,
        )
        .run();
      return database
        .prepare(
          'SELECT shawn_comment,sun_comment,shawn_rating,sun_rating FROM activities WHERE id=? AND published=1',
        )
        .bind(id)
        .first<HostReviews>();
    },
    consumeLimit: (key, now, expires) => auth.consumeLimit(key, now, expires),
  };
}

export async function runtimeTripCommunityHandlers() {
  const { env } = await import('cloudflare:workers');
  const database = (env as { DB?: D1Database }).DB;
  if (!database) throw new Error('The community database is unavailable.');
  return createTripCommunityHandlers(createTripCommunityStore(database), {
    authenticate: authenticateRequest,
  });
}
