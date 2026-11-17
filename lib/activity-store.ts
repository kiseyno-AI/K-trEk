import { env } from 'cloudflare:workers';
import {
  ACTIVITY_COLUMNS,
  BOOLEAN_FIELDS,
  URL_LIST_FIELDS,
  parseActivity,
  toActivity,
  type ActivityInput,
  type ActivityRecord,
} from './activities';

function database(): D1Database {
  const database = (env as { DB?: D1Database }).DB;
  if (!database)
    throw new Error(
      'Activity database binding is unavailable. Configure DB and run the local setup command.',
    );
  return database;
}
function decode(row: Record<string, unknown>): ActivityRecord {
  const input = Object.fromEntries(
    ACTIVITY_COLUMNS.map((key) => [key, row[key]]),
  );
  for (const key of URL_LIST_FIELDS)
    input[key] = JSON.parse(typeof input[key] === 'string' ? input[key] : '[]');
  for (const key of BOOLEAN_FIELDS) input[key] = Number(input[key]) === 1;
  return {
    ...parseActivity(input),
    created_at: String(row.created_at),
    updated_at: String(row.updated_at),
  };
}
function values(record: ActivityInput, keys: (keyof ActivityInput)[]) {
  return keys.map((key) => {
    const value = record[key];
    if ((URL_LIST_FIELDS as readonly string[]).includes(key))
      return JSON.stringify(value);
    return typeof value === 'boolean'
      ? Number(value)
      : (value as string | number | null);
  });
}
export async function listActivityRecords(): Promise<ActivityRecord[]> {
  const result = await database()
    .prepare('SELECT * FROM activities ORDER BY created_at, rowid')
    .all<Record<string, unknown>>();
  return result.results.map(decode);
}
export async function listActivities() {
  const result = await database()
    .prepare(
      'SELECT * FROM activities WHERE published = 1 ORDER BY created_at, rowid',
    )
    .all<Record<string, unknown>>();
  return result.results.map((row) => toActivity(decode(row)));
}
export async function createActivity(
  input: ActivityInput,
): Promise<ActivityRecord> {
  const record = parseActivity(input);
  await database()
    .prepare(
      `INSERT INTO activities (${ACTIVITY_COLUMNS.join(', ')}) VALUES (${ACTIVITY_COLUMNS.map(() => '?').join(', ')})`,
    )
    .bind(...values(record, ACTIVITY_COLUMNS))
    .run();
  return (await findActivity(record.id))!;
}
export async function updateActivity(
  id: string,
  input: ActivityInput,
): Promise<ActivityRecord | null> {
  const record = parseActivity(input);
  if (record.id !== id)
    throw new Error('The card ID cannot change during an update.');
  const keys = ACTIVITY_COLUMNS.filter((key) => key !== 'id');
  const result = await database()
    .prepare(
      `UPDATE activities SET ${keys.map((key) => `${key} = ?`).join(', ')}, updated_at = strftime('%Y-%m-%dT%H:%M:%fZ', 'now') WHERE id = ?`,
    )
    .bind(...values(record, keys), id)
    .run();
  return result.meta.changes ? findActivity(id) : null;
}
export async function findActivity(id: string): Promise<ActivityRecord | null> {
  const row = await database()
    .prepare('SELECT * FROM activities WHERE id = ?')
    .bind(id)
    .first<Record<string, unknown>>();
  return row ? decode(row) : null;
}
