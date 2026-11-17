import test from 'node:test';
import assert from 'node:assert/strict';
import { existsSync } from 'node:fs';
import { readFile } from 'node:fs/promises';
import { parseActivity, toActivity } from '../lib/activities.ts';

await test('all seventy candidates have sourced WGS84 pins that drive the public map focus', async () => {
  const path = new URL('../data/activity-coordinates.json', import.meta.url);
  assert.ok(
    existsSync(path),
    'The complete sourced coordinate manifest must exist.',
  );
  const manifest = JSON.parse(await readFile(path, 'utf8'));
  const activities = JSON.parse(
    await readFile(
      new URL('../data/activities-70.json', import.meta.url),
      'utf8',
    ),
  );
  assert.equal(manifest.crs, 'EPSG:4326');
  assert.equal(manifest.activities.length, 70);
  assert.equal(new Set(manifest.activities.map((point) => point.id)).size, 70);
  assert.equal(manifest.origin.longitude, 126.9707793);
  assert.equal(manifest.origin.latitude, 37.5545547);
  for (const point of manifest.activities) {
    const activity = activities.find((record) => record.id === point.id);
    assert.equal(point.name_ko, activity?.name_ko);
    assert.equal(point.checked_at, '2026-11-15');
    assert.ok(
      ['venue', 'site', 'area_start', 'building'].includes(point.precision),
    );
    assert.ok(point.latitude >= 37 && point.latitude <= 38.1);
    assert.ok(point.longitude >= 126.5 && point.longitude <= 127.6);
    assert.ok(
      point.pin_label && point.pin_description && point.source_urls.length > 0,
    );
    for (const link of point.source_urls)
      assert.equal(new URL(link).protocol, 'https:');
    if (activity.location_type === 'area')
      assert.equal(point.precision, 'area_start');
    const parsed = parseActivity({
      ...activity,
      latitude: point.latitude,
      longitude: point.longitude,
      coordinate_status: 'verified',
    });
    assert.deepEqual(toActivity(parsed).mapFocus, [
      point.longitude,
      point.latitude,
    ]);
    assert.equal(toActivity(parsed).mapIsIllustrative, false);
  }
});

const { DatabaseSync } = await import('node:sqlite');
const { ACTIVITY_COLUMNS, BOOLEAN_FIELDS, URL_LIST_FIELDS } =
  await import('../lib/activities.ts');
const { buildActivityCoordinateStatements, coordinateSqlBatches } =
  await import('../scripts/import-activity-coordinates.mjs');

await test('coordinate import preserves verified manual pins, photos and editorial data, and is idempotent in bounded SQLite batches', async () => {
  const manifest = JSON.parse(
    await readFile(
      new URL('../data/activity-coordinates.json', import.meta.url),
      'utf8',
    ),
  );
  const activities = JSON.parse(
    await readFile(
      new URL('../data/activities-70.json', import.meta.url),
      'utf8',
    ),
  );
  const db = new DatabaseSync(':memory:');
  db.exec(
    await readFile(
      new URL('../db/migrations/0001_activities.sql', import.meta.url),
      'utf8',
    ),
  );
  db.exec(
    await readFile(
      new URL(
        '../db/migrations/0002_history_and_photo_credits.sql',
        import.meta.url,
      ),
      'utf8',
    ),
  );
  for (const migration of [
    '0003_official_photo_references.sql',
    '0004_host_reviews_and_card_location.sql',
  ])
    db.exec(
      await readFile(
        new URL('../db/migrations/' + migration, import.meta.url),
        'utf8',
      ),
    );
  const firstQaIds = [
    'food-samwon-garden',
    'history-gyeongbokgung',
    'wellness-lienjang-gangnam',
  ];
  for (const input of activities) {
    const point = manifest.activities.find((point) => point.id === input.id);
    const sameVerified = firstQaIds.includes(input.id);
    const record = parseActivity({
      ...input,
      latitude: sameVerified ? point.latitude : null,
      longitude: sameVerified ? point.longitude : null,
      coordinate_status: sameVerified ? 'verified' : 'unassigned',
      image_url: '/trip/photos/keep-photo.webp',
      image_rights: 'licensed',
      image_caption: 'Keep my caption',
      image_attribution: 'Keep my credit',
      source_urls: ['https://example.com/original-source'],
      source_evidence:
        'Keep original research.\nPhoto (venue): Keep photo evidence.',
      shawn_comment: 'Keep my personal comment',
    });
    const values = ACTIVITY_COLUMNS.map((key) =>
      URL_LIST_FIELDS.includes(key)
        ? JSON.stringify(record[key])
        : BOOLEAN_FIELDS.includes(key)
          ? Number(record[key])
          : record[key],
    );
    db.prepare(
      `INSERT INTO activities (${ACTIVITY_COLUMNS.join(',')}) VALUES (${ACTIVITY_COLUMNS.map(() => '?').join(',')})`,
    ).run(...values);
  }
  db.exec(
    "UPDATE activities SET latitude=37.6,longitude=127.1,coordinate_status='verified',source_evidence='My verified manual point' WHERE id='food-jin-jin'",
  );
  db.exec(
    "UPDATE activities SET latitude=37.61,longitude=127.11,coordinate_status='unverified',source_evidence='My unverified manual point' WHERE id='food-born-and-bred'",
  );
  db.exec(
    "UPDATE activities SET name_ko='직접 변경한 이름' WHERE id='food-balwoo-gongyang'",
  );
  db.exec(
    "INSERT INTO activities(id,name_ko,name_en) VALUES('unrelated','기타','Unrelated record')",
  );
  const skippedIds = [
    'food-jin-jin',
    'food-born-and-bred',
    'food-balwoo-gongyang',
    'unrelated',
  ];
  const skippedBefore = skippedIds.map((id) =>
    db.prepare('SELECT * FROM activities WHERE id=?').get(id),
  );
  const statements = buildActivityCoordinateStatements(manifest, activities);
  assert.equal(statements.length, 70);
  const batches = coordinateSqlBatches(statements);
  assert.ok(batches.length > 1);
  for (const batch of batches) {
    assert.ok(Buffer.byteLength(batch) <= 50000);
    db.exec(batch);
  }
  for (const point of manifest.activities) {
    if (skippedIds.includes(point.id)) continue;
    const row = db.prepare('SELECT * FROM activities WHERE id=?').get(point.id);
    assert.equal(row.latitude, point.latitude);
    assert.equal(row.longitude, point.longitude);
    assert.equal(row.coordinate_status, 'verified');
    assert.equal(row.image_url, '/trip/photos/keep-photo.webp');
    assert.equal(row.image_caption, 'Keep my caption');
    assert.equal(row.image_attribution, 'Keep my credit');
    assert.equal(row.shawn_comment, 'Keep my personal comment');
    assert.equal(
      row.checked_at,
      null,
      'Coordinate checking must not mark every card fact verified.',
    );
    assert.ok(
      row.source_evidence.startsWith(
        'Keep original research.\nPhoto (venue): Keep photo evidence.',
      ),
    );
    assert.match(row.source_evidence, /Coordinate pin \[.*WGS84; 2026-11-15\]/);
    assert.ok(
      JSON.parse(row.source_urls).includes(
        'https://example.com/original-source',
      ),
    );
    for (const link of point.source_urls)
      assert.ok(JSON.parse(row.source_urls).includes(link));
    const activity = activities.find((activity) => activity.id === point.id);
    if (activity.location_type === 'area') {
      assert.ok(row.area_description.startsWith(activity.area_description));
      assert.ok(
        row.area_description.includes(
          'Map starting point: ' +
            point.pin_label +
            '. ' +
            point.pin_description,
        ),
      );
    }
  }
  for (const [index, id] of skippedIds.entries())
    assert.deepEqual(
      db.prepare('SELECT * FROM activities WHERE id=?').get(id),
      skippedBefore[index],
    );
  const beforeRerun = db.prepare('SELECT * FROM activities ORDER BY id').all();
  for (const batch of batches) db.exec(batch);
  assert.deepEqual(
    db.prepare('SELECT * FROM activities ORDER BY id').all(),
    beforeRerun,
  );
  assert.equal(db.prepare('SELECT COUNT(*) AS n FROM activities').get().n, 71);
  const byId = Object.fromEntries(
    manifest.activities.map((point) => [point.id, point]),
  );
  assert.deepEqual(
    [byId['wellness-cnp-dogok'].longitude, byId['wellness-cnp-dogok'].latitude],
    [127.033902, 37.485674],
  );
  assert.deepEqual(
    [
      byId['wellness-leaders-cheongdam'].longitude,
      byId['wellness-leaders-cheongdam'].latitude,
    ],
    [127.0461088, 37.5265497],
  );
  assert.deepEqual(
    [
      byId['shopping-musinsa-daelim'].longitude,
      byId['shopping-musinsa-daelim'].latitude,
    ],
    [127.0563857, 37.5415531],
  );
  assert.deepEqual(
    [byId['nature-dumulmeori'].longitude, byId['nature-dumulmeori'].latitude],
    [127.3163124, 37.5338587],
  );
  assert.throws(
    () =>
      buildActivityCoordinateStatements(
        { ...manifest, activities: manifest.activities.slice(1) },
        activities,
      ),
    /70 coordinate/,
  );
  db.close();
});
