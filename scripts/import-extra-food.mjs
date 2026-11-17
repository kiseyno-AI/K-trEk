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

export function buildExtraFoodImportSql(inputs) {
  const rows = inputs.map(parseActivity);
  const expected = new Set([
    'food-myeongdong-kyoja-main',
    'food-hadongkwan-myeongdong',
    'food-tosokchon-samgyetang',
    'food-woo-lae-oak',
    'food-gwanghwamun-mijin',
  ]);
  assert.equal(rows.length, 5, 'Expected five additional restaurants.');
  assert.equal(
    new Set(rows.map((row) => row.id)).size,
    5,
    'Restaurant IDs must be unique.',
  );
  const quote = (value) =>
    value === null
      ? 'NULL'
      : typeof value === 'number'
        ? String(value)
        : `'${String(value).replaceAll("'", "''")}'`;
  return rows
    .map((row) => {
      assert.ok(expected.has(row.id), 'Unexpected additional restaurant ID.');
      assert.equal(row.category_id, 'food');
      assert.equal(row.region_id, 'seoul');
      assert.equal(row.coordinate_status, 'verified');
      assert.ok(
        row.latitude > 37.5 &&
          row.latitude < 37.7 &&
          row.longitude > 126.9 &&
          row.longitude < 127.1,
        'Expected a checked Seoul venue pin.',
      );
      assert.match(
        row.image_url ?? '',
        /^\/trip\/photos\/food-extra-[a-z-]+\.webp$/,
      );
      assert.ok(
        row.checked_at && row.source_urls.length && row.source_evidence,
      );
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
      new URL('../data/extra-food-2026-11.json', import.meta.url),
      'utf8',
    ),
  );
  const sql = buildExtraFoodImportSql(rows);
  for (const row of rows)
    assert.ok(
      (await readFile(new URL('../public' + row.image_url, import.meta.url)))
        .length > 1000,
      `Missing photo: ${row.id}`,
    );
  if (process.argv[2] === '--sql' && process.argv[3]) {
    const path = resolve(process.argv[3]);
    await writeFile(path, sql + '\n');
    console.log(
      `Validated five restaurants; INSERT OR IGNORE SQL written to ${path}. No database was changed.`,
    );
  } else {
    assert.ok(
      process.argv.length === 2 ||
        (process.argv.length === 3 && process.argv[2] === '--check'),
      'Usage: node scripts/import-extra-food.mjs [--check | --sql path]',
    );
    console.log(
      'Extra food dataset valid: five restaurants with venue photos and checked coordinates. No database was changed.',
    );
  }
}

if (
  process.argv[1] &&
  import.meta.url === pathToFileURL(resolve(process.argv[1])).href
)
  await main();
