import { createTripAuthStore } from './trip-auth-store.ts';
import {
  ACTIVITY_COLUMNS,
  BOOLEAN_FIELDS,
  URL_LIST_FIELDS,
  parseActivity,
  type ActivityRecord,
} from './activities.ts';
import { createTripCommunityStore } from './trip-community-store.ts';
import type {
  AssistantEvent,
  AssistantSummary,
  TripAssistantStore,
} from './trip-assistant.ts';

export function createTripAssistantStore(
  database: D1Database,
): TripAssistantStore {
  const auth = createTripAuthStore(database);
  const community = createTripCommunityStore(database);
  const sessionInsert = (userId: string, sessionId: string, now: number) =>
    database
      .prepare(
        'INSERT OR IGNORE INTO trip_assistant_sessions(user_id,session_id,started_at,last_event_at) VALUES(?,?,?,?)',
      )
      .bind(userId, sessionId, now, now);
  const ensure = async (userId: string, sessionId: string, now: number) => {
    await sessionInsert(userId, sessionId, now).run();
  };
  const summary = async (
    userId: string,
    sessionId: string,
    now: number,
  ): Promise<AssistantSummary> => {
    const [session, recent, counts] = await Promise.all([
      database
        .prepare(
          'SELECT active_seconds FROM trip_assistant_sessions WHERE user_id=? AND session_id=?',
        )
        .bind(userId, sessionId)
        .first<{ active_seconds: number }>(),
      database
        .prepare(
          "SELECT activity_id FROM trip_assistant_events WHERE user_id=? AND session_id=? AND event='card_open' AND activity_id IS NOT NULL AND created_at>=? ORDER BY created_at DESC,rowid DESC LIMIT 5",
        )
        .bind(userId, sessionId, now - 300000)
        .all<{ activity_id: string }>(),
      database
        .prepare(
          "SELECT activity_id,count(*) AS count FROM trip_assistant_events WHERE user_id=? AND session_id=? AND event='card_open' AND activity_id IS NOT NULL GROUP BY activity_id",
        )
        .bind(userId, sessionId)
        .all<{ activity_id: string; count: number }>(),
    ]);
    return {
      activeSeconds: session?.active_seconds ?? 0,
      recentActivityIds: recent.results.map((row) => row.activity_id).reverse(),
      cardCounts: Object.fromEntries(
        counts.results.map((row) => [row.activity_id, row.count]),
      ),
    };
  };
  return {
    async publishedIds() {
      const result = await database
        .prepare('SELECT id FROM activities WHERE published=1')
        .all<{ id: string }>();
      return result.results.map((row) => row.id);
    },
    async activities() {
      const rows = await database
        .prepare(
          'SELECT * FROM activities WHERE published=1 ORDER BY created_at,rowid',
        )
        .all<Record<string, unknown>>();
      return rows.results.map((row) => {
        const input: Record<string, unknown> = Object.fromEntries(
          ACTIVITY_COLUMNS.map((key) => [key, row[key]]),
        );
        for (const key of URL_LIST_FIELDS)
          input[key] = JSON.parse(
            typeof input[key] === 'string' ? input[key] : '[]',
          );
        for (const key of BOOLEAN_FIELDS) input[key] = Number(input[key]) === 1;
        return {
          ...parseActivity(input),
          created_at: String(row.created_at),
          updated_at: String(row.updated_at),
        } as ActivityRecord;
      });
    },
    async summary(userId, sessionId, now) {
      await ensure(userId, sessionId, now);
      return summary(userId, sessionId, now);
    },
    async preferences(userId) {
      const [prefs, favoriteIds] = await Promise.all([
        community.preferences(userId),
        auth.favorites(userId),
      ]);
      return {
        categoryIds: prefs.categoryIds,
        draftVoteIds: prefs.draftVoteIds,
        submittedVoteIds: prefs.submittedVoteIds,
        favoriteIds,
      };
    },
    async recordEvent(userId, event: AssistantEvent, now) {
      // One transaction keeps retries safe; changes() gates the clock on a new receipt.
      const results = await database.batch([
        sessionInsert(userId, event.sessionId, now),
        database
          .prepare(
            'INSERT OR IGNORE INTO trip_assistant_events(user_id,session_id,event_id,event,activity_id,elapsed_seconds,created_at) VALUES(?,?,?,?,?,0,?)',
          )
          .bind(
            userId,
            event.sessionId,
            event.eventId,
            event.event,
            event.activityId ?? null,
            now,
          ),
        database
          .prepare(
            'UPDATE trip_assistant_sessions SET active_seconds=CAST(MAX(active_seconds,MIN(86400,?,active_seconds+MIN(90,MAX(0,(?-last_event_at)/1000)))) AS INTEGER),last_event_at=MAX(last_event_at,?) WHERE user_id=? AND session_id=? AND changes()=1',
          )
          .bind(event.elapsedSeconds, now, now, userId, event.sessionId),
        database
          .prepare(
            'UPDATE trip_assistant_events SET elapsed_seconds=(SELECT active_seconds FROM trip_assistant_sessions WHERE user_id=? AND session_id=?) WHERE user_id=? AND session_id=? AND event_id=? AND changes()=1',
          )
          .bind(
            userId,
            event.sessionId,
            userId,
            event.sessionId,
            event.eventId,
          ),
      ]);
      if (results[1].meta.changes !== 1) return null;
      return summary(userId, event.sessionId, now);
    },
    async claimPattern(userId, sessionId, pattern, now) {
      const result = await database
        .prepare(
          "UPDATE trip_assistant_sessions SET last_proactive_at=?,triggered_patterns=json_insert(triggered_patterns,'$[#]',?) WHERE user_id=? AND session_id=? AND (last_proactive_at IS NULL OR last_proactive_at<=?) AND NOT EXISTS(SELECT 1 FROM json_each(triggered_patterns) WHERE value=?)",
        )
        .bind(now, pattern, userId, sessionId, now - 300000, pattern)
        .run();
      return result.meta.changes === 1;
    },
    async saveMessage(userId, sessionId, message, trigger, now) {
      await database
        .prepare(
          'INSERT INTO trip_assistant_messages(id,user_id,session_id,text,sources,report_draft,trigger,created_at) VALUES(?,?,?,?,?,?,?,?)',
        )
        .bind(
          message.id,
          userId,
          sessionId,
          message.text,
          JSON.stringify(message.sources),
          message.reportDraft ?? null,
          trigger,
          now,
        )
        .run();
    },
    async message(userId, messageId) {
      const row = await database
        .prepare(
          'SELECT id,text,sources,report_draft FROM trip_assistant_messages WHERE user_id=? AND id=?',
        )
        .bind(userId, messageId)
        .first<{
          id: string;
          text: string;
          sources: string;
          report_draft: string | null;
        }>();
      return row
        ? {
            id: row.id,
            text: row.text,
            sources: JSON.parse(row.sources),
            ...(row.report_draft ? { reportDraft: row.report_draft } : {}),
          }
        : null;
    },
    async heard(userId, messageId, now) {
      const result = await database
        .prepare(
          'UPDATE trip_assistant_messages SET heard_at=COALESCE(heard_at,?) WHERE user_id=? AND id=?',
        )
        .bind(now, userId, messageId)
        .run();
      return result.meta.changes === 1;
    },
    consumeLimit: (key, now, expiresAt) =>
      auth.consumeLimit(key, now, expiresAt),
  };
}
export async function runtimeTripAssistantStore() {
  const { env } = await import('cloudflare:workers');
  const database = (env as { DB?: D1Database }).DB;
  if (!database) throw new Error('The assistant database is unavailable.');
  return createTripAssistantStore(database);
}
