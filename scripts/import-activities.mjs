import { mkdtemp, readFile, writeFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { spawnSync } from 'node:child_process';
import {
  ACTIVITY_COLUMNS,
  BOOLEAN_FIELDS,
  URL_LIST_FIELDS,
  parseActivity,
} from '../lib/activities.ts';

const root = fileURLToPath(new URL('../', import.meta.url));
export const IMPORT_CATEGORIES = [
  'food',
  'history',
  'culture',
  'nature',
  'experience',
  'shopping',
  'wellness',
];

export function buildActivityImportSql(inputs) {
  const rows = inputs.map(parseActivity);
  if (rows.length !== 70 || new Set(rows.map((row) => row.id)).size !== 70)
    throw new Error('The supplied import must contain 70 unique cards.');
  for (const category of IMPORT_CATEGORIES)
    if (rows.filter((row) => row.category_id === category).length !== 10)
      throw new Error(`Expected 10 cards in ${category}.`);
  const quote = (value) =>
    value === null
      ? 'NULL'
      : typeof value === 'number'
        ? String(value)
        : `'${String(value).replaceAll("'", "''")}'`;
  return [
    "UPDATE activities SET published = 0, updated_at = strftime('%Y-%m-%dT%H:%M:%fZ', 'now') WHERE id IN ('temple', 'seoul', 'busan') AND is_illustrative = 1 AND published = 1;",
    ...rows.map((record) => {
      const values = ACTIVITY_COLUMNS.map((key) =>
        URL_LIST_FIELDS.includes(key)
          ? JSON.stringify(record[key])
          : BOOLEAN_FIELDS.includes(key)
            ? Number(record[key])
            : record[key],
      );
      return `INSERT OR IGNORE INTO activities (${ACTIVITY_COLUMNS.join(', ')}) VALUES (${values.map(quote).join(', ')});`;
    }),
  ].join('\n');
}

async function main() {
  const rows = JSON.parse(
    await readFile(
      new URL('../data/activities-70.json', import.meta.url),
      'utf8',
    ),
  );
  const sql = buildActivityImportSql(rows);
  const temporary = await mkdtemp(join(tmpdir(), 'korea-activity-import-'));
  try {
    const file = join(temporary, 'import.sql');
    await writeFile(file, sql);
    const result = spawnSync(
      process.execPath,
      [
        resolve(root, 'node_modules/wrangler/bin/wrangler.js'),
        'd1',
        'execute',
        'DB',
        '--local',
        '--config',
        resolve(root, 'db/wrangler.local.jsonc'),
        '--persist-to',
        resolve(root, '.wrangler/state'),
        '--file',
        file,
      ],
      {
        cwd: root,
        stdio: 'inherit',
        env: {
          ...process.env,
          WRANGLER_WRITE_LOGS: 'false',
          MINIFLARE_REGISTRY_PATH: resolve(root, '.wrangler/registry'),
        },
      },
    );
    if (result.status !== 0)
      throw new Error(
        'Local activity import failed. Run npm run db:setup first.',
      );
    console.log(
      '70 supplied activity IDs imported when absent; existing edits preserved. The three illustrative samples are hidden.',
    );
  } finally {
    await rm(temporary, { recursive: true, force: true });
  }
}

if (
  process.argv[1] &&
  import.meta.url === pathToFileURL(resolve(process.argv[1])).href
)
  await main();
