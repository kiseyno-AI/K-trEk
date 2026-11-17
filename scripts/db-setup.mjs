import { mkdtemp, writeFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { spawnSync } from 'node:child_process';
import {
  ACTIVITY_COLUMNS,
  BOOLEAN_FIELDS,
  URL_LIST_FIELDS,
  parseActivity,
} from '../lib/activities.ts';
import { activitySeeds } from '../lib/activity-seed.ts';

const root = fileURLToPath(new URL('../', import.meta.url));
const temporary = await mkdtemp(join(tmpdir(), 'korea-activity-seed-'));
const quote = (value) =>
  value === null
    ? 'NULL'
    : typeof value === 'number'
      ? String(value)
      : `'${String(value).replaceAll("'", "''")}'`;
const execute = (args) => {
  const result = spawnSync(
    process.execPath,
    [
      resolve(root, 'node_modules/wrangler/bin/wrangler.js'),
      'd1',
      ...args,
      'DB',
      '--local',
      '--config',
      resolve(root, 'db/wrangler.local.jsonc'),
      '--persist-to',
      resolve(root, process.env.KTRAVEL_DEV_STATE_PATH || '.wrangler/local-state'),
    ],
    {
      cwd: root,
      stdio: 'inherit',
      env: {
        ...process.env,
        WRANGLER_WRITE_LOGS: 'false',
        CI: 'true',
        MINIFLARE_REGISTRY_PATH: resolve(root, '.wrangler/registry'),
      },
    },
  );
  if (result.status !== 0) throw new Error('Local D1 setup failed.');
};
try {
  execute(['migrations', 'apply']);
  const rows = activitySeeds.map(parseActivity);
  const sql = rows
    .map((record) => {
      const values = ACTIVITY_COLUMNS.map((key) =>
        URL_LIST_FIELDS.includes(key)
          ? JSON.stringify(record[key])
          : BOOLEAN_FIELDS.includes(key)
            ? Number(record[key])
            : record[key],
      );
      return `INSERT OR IGNORE INTO activities (${ACTIVITY_COLUMNS.join(', ')}) VALUES (${values.map(quote).join(', ')});`;
    })
    .join('\n');
  const file = join(temporary, 'seed.sql');
  await writeFile(file, sql);
  execute(['execute', '--file', file]);
  console.log(
    `Local activities table ready. ${rows.length} illustrative samples inserted if their IDs were absent; existing edits are preserved.`,
  );
} finally {
  await rm(temporary, { recursive: true, force: true });
}
