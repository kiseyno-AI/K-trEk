import assert from 'node:assert/strict';
import { readFile, writeFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { pathToFileURL } from 'node:url';
import {
  ACTIVITY_COLUMNS,
  BOOLEAN_FIELDS,
  URL_LIST_FIELDS,
  parseActivity,
} from '../lib/activities.ts';

export function buildRegionalImportSql(inputs) {
  const rows = inputs.map(parseActivity);
  const expected = new Set([
    'nature-garden-morning-calm',
    'nature-nami-island',
    'nature-pocheon-art-valley',
    'experience-gwangmyeong-cave',
    'experience-gangchon-gimyujeong-railbike',
    'experience-yeongjong-seaside-railbike',
    'food-bonsuwon-galbi-main',
    'food-chuncheon-tongnamujip-main',
    'food-sinseung-banjeom-incheon',
  ]);
  assert.equal(rows.length, 9, 'Expected nine regional additions.');
  assert.equal(
    new Set(rows.map((row) => row.id)).size,
    9,
    'Regional IDs must be unique.',
  );
  for (const category of ['nature', 'experience', 'food'])
    assert.equal(rows.filter((row) => row.category_id === category).length, 3);
  const quote = (value) =>
    value === null
      ? 'NULL'
      : typeof value === 'number'
        ? String(value)
        : `'${String(value).replaceAll("'", "''")}'`;
  return rows
    .map((row) => {
      assert.ok(expected.has(row.id), 'Unexpected regional candidate ID.');
      assert.ok(['gyeonggi', 'gangwon', 'incheon'].includes(row.region_id));
      assert.equal(row.coordinate_status, 'verified');
      assert.ok(
        row.latitude > 37 &&
          row.latitude < 38.2 &&
          row.longitude > 126.4 &&
          row.longitude < 128.1,
        'Expected a checked regional day-trip pin.',
      );
      assert.ok(
        row.card_location &&
          row.checked_at &&
          row.source_urls.length &&
          row.source_evidence,
      );
      assert.match(
        row.image_url ?? '',
        /^\/trip\/photos\/regional-[a-z-]+\.webp$/,
      );
      assert.equal(row.driving_minutes, null);
      assert.equal(row.shawn_comment, null);
      assert.equal(row.sun_rating, null);
      const values = ACTIVITY_COLUMNS.map((key) =>
        URL_LIST_FIELDS.includes(key)
          ? JSON.stringify(row[key])
          : BOOLEAN_FIELDS.includes(key)
            ? Number(row[key])
            : row[key],
      );
      return `INSERT OR IGNORE INTO activities (${ACTIVITY_COLUMNS.join(', ')}) VALUES (${values.map(quote).join(', ')});`;
    })
    .join('\n');
}

async function main() {
  const rows = JSON.parse(
    await readFile(
      new URL('../data/regional-candidates-2026-11.json', import.meta.url),
      'utf8',
    ),
  );
  const sql = buildRegionalImportSql(rows);
  for (const row of rows) {
    const photo = await readFile(
      new URL('../public' + row.image_url, import.meta.url),
    );
    assert.ok(
      photo.length > 1000 &&
        photo.toString('ascii', 0, 4) === 'RIFF' &&
        photo.toString('ascii', 8, 12) === 'WEBP',
      `Missing or invalid photo: ${row.id}`,
    );
  }
  if (process.argv[2] === '--sql' && process.argv[3]) {
    const path = resolve(process.argv[3]);
    await writeFile(path, sql + '\n');
    console.log(
      `Validated nine regional candidates; INSERT OR IGNORE SQL written to ${path}. No database was changed.`,
    );
  } else {
    assert.ok(
      process.argv.length === 2 ||
        (process.argv.length === 3 && process.argv[2] === '--check'),
      'Usage: node scripts/import-regional-candidates.mjs [--check | --sql path]',
    );
    console.log(
      'Regional dataset valid: nine candidates, checked pins and local named-subject photos. No database was changed.',
    );
  }
}

if (
  process.argv[1] &&
  import.meta.url === pathToFileURL(resolve(process.argv[1])).href
)
  await main();
