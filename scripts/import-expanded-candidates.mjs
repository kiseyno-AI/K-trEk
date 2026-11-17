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

export function buildExpandedImportSql(inputs) {
  const rows = inputs.map(parseActivity);
  const expected = new Set([
    'food-wiir-philadelphia',
    'food-geumdwaeji-sikdang',
    'food-jinokhwa-dakhanmari',
    'food-mabongnim-tteokbokki',
    'food-samcheongdong-sujebi',
    'food-joongang-haejang',
    'food-neungdong-minari-sinyongsan',
    'food-sungsimdang-main',
    'food-gwangcheon-daejeon',
    'food-sungmidang-jeonju-main',
    'food-hyundaiok-nambu-market',
    'food-chodang-halmeoni-sundubu',
    'food-eomjine-pojangmacha-main',
    'food-jjoljjol-hotteok-cheongju',
    'nightlife-faust-seoul',
    'nightlife-cakeshop-seoul',
    'nightlife-volnost-seoul',
    'shopping-hyundai-outlets-songdo',
    'shopping-oliveyoung-central-myeongdong',
    'shopping-starfield-suwon',
    'experience-everland-yongin',
    'experience-icheon-cerapia-pottery',
    'experience-food-culture-korea-cooking',
    'experience-museum-kimchikan-class',
    'experience-sool-company-makgeolli',
    'experience-samhae-soju-brewery',
    'experience-sansawon-pocheon',
    'experience-jeonju-traditional-liquor',
    'experience-myeongin-andong-soju',
    'experience-jeonju-millennium-hanji',
  ]);
  assert.equal(rows.length, 30, 'Expected thirty expanded additions.');
  assert.equal(
    new Set(rows.map((row) => row.id)).size,
    30,
    'Expanded IDs must be unique.',
  );
  for (const [category, count] of Object.entries({
    food: 14,
    nightlife: 3,
    shopping: 3,
    experience: 10,
  }))
    assert.equal(
      rows.filter((row) => row.category_id === category).length,
      count,
    );
  const quote = (value) =>
    value === null
      ? 'NULL'
      : typeof value === 'number'
        ? String(value)
        : `'${String(value).replaceAll("'", "''")}'`;
  return rows
    .map((row) => {
      assert.ok(expected.has(row.id), 'Unexpected expanded candidate ID.');
      assert.equal(row.coordinate_status, 'verified');
      assert.ok(
        row.latitude > 33 &&
          row.latitude < 39 &&
          row.longitude > 124 &&
          row.longitude < 130,
        'Expected a checked South Korea destination pin.',
      );
      assert.ok(
        row.card_location &&
          row.checked_at &&
          row.source_urls.length &&
          row.source_evidence,
      );
      if (row.id === 'food-wiir-philadelphia') {
        assert.equal(
          row.image_url,
          null,
          'Do not substitute an unrelated cheesesteak or mislabel a review photo.',
        );
        assert.equal(row.image_rights, 'unverified');
      } else {
        assert.match(
          row.image_url ?? '',
          /^\/trip\/photos\/expanded-[a-z-]+\.webp$/,
        );
        assert.equal(row.image_rights, 'official_reference');
      }
      assert.equal(row.driving_minutes, null);
      assert.equal(row.shawn_comment, null);
      assert.equal(row.sun_rating, null);
      assert.equal(row.shawn_rating, null);
      assert.equal(row.sun_comment, null);
      assert.equal(row.google_rating, null);
      assert.equal(row.google_review_count, null);
      assert.equal(row.google_place_id, null);
      assert.equal(row.booking_status, 'unknown');
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
      new URL('../data/expanded-candidates-2026-11.json', import.meta.url),
      'utf8',
    ),
  );
  const sql = buildExpandedImportSql(rows);
  for (const row of rows) {
    if (!row.image_url) continue;
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
      `Validated thirty expanded candidates and 29 local photos; INSERT OR IGNORE SQL written to ${path}. No database was changed.`,
    );
  } else {
    assert.ok(
      process.argv.length === 2 ||
        (process.argv.length === 3 && process.argv[2] === '--check'),
      'Usage: node scripts/import-expanded-candidates.mjs [--check | --sql path]',
    );
    console.log(
      'Expanded dataset valid: thirty candidates, checked pins and 29 local photos; WIIR menu photo pending. No database was changed.',
    );
  }
}

if (
  process.argv[1] &&
  import.meta.url === pathToFileURL(resolve(process.argv[1])).href
)
  await main();
