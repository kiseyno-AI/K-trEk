import assert from 'node:assert/strict';
import test from 'node:test';
import { readFile } from 'node:fs/promises';
import { DatabaseSync } from 'node:sqlite';
import {
  ACTIVITY_COLUMNS,
  BOOLEAN_FIELDS,
  URL_LIST_FIELDS,
  parseActivity,
  toActivity,
} from '../lib/activities.ts';
import { buildActivityPhotoSql } from '../scripts/import-activity-photos.mjs';

const identity = {
  id: 'official-clinic',
  name_ko: '공식 의원',
  name_en: 'Official Clinic',
  category_id: 'wellness',
};
const reference = {
  ...identity,
  image_rights: 'official_reference',
  image_url: 'https://clinic.example/images/clinic.jpg',
  image_reference_urls: ['https://clinic.example/facilities'],
};

await test('an official reference remains explicitly unlicensed when displayed', () => {
  const record = parseActivity(reference);
  const card = toActivity(record);
  assert.equal(card.image, reference.image_url);
  assert.equal(card.details.image_rights, 'official_reference');
  assert.equal(
    parseActivity({
      ...reference,
      image_url: '/trip/photos/official-clinic.webp',
    }).image_url,
    '/trip/photos/official-clinic.webp',
  );
  const legacyReferences = [
    'http://creativecommons.org/publicdomain/zero/1.0/deed.en',
    ...reference.image_reference_urls,
  ];
  assert.deepEqual(
    parseActivity({ ...reference, image_reference_urls: legacyReferences })
      .image_reference_urls,
    legacyReferences,
    'A current HTTPS source can coexist with historical license references.',
  );
  for (const invalid of [
    { image_url: null },
    { image_reference_urls: [] },
    { image_url: 'http://clinic.example/photo.jpg' },
    { image_url: 'javascript:alert(1)' },
    { image_url: '/trip/photos/../private.png' },
    { image_url: '/trip/photos/not-an-image.svg' },
    { image_reference_urls: ['http://clinic.example/facilities'] },
    { image_rights: 'unverified' },
  ])
    assert.throws(() => parseActivity({ ...reference, ...invalid }));
});

await test('the official-reference upgrade preserves all 73 rows, columns, timestamps and the existing primary-key index', async () => {
  const database = new DatabaseSync(':memory:');
  for (const migration of [
    '0001_activities.sql',
    '0002_history_and_photo_credits.sql',
  ])
    database.exec(
      await readFile(
        new URL('../db/migrations/' + migration, import.meta.url),
        'utf8',
      ),
    );
  const historicalColumns = database
    .prepare('PRAGMA table_info(activities)')
    .all()
    .map((row) => row.name)
    .filter((key) => ACTIVITY_COLUMNS.includes(key));
  for (let index = 0; index < 73; index += 1) {
    const record = parseActivity({
      ...identity,
      id: `preserve-${index}`,
      name_ko: `보존 장소 ${index}`,
      name_en: `Preserved place ${index}`,
      category_id: index % 2 ? 'history' : 'wellness',
      region_name: 'Seoul',
      address: `Address ${index}`,
      summary_en: `Summary ${index}`,
      activity_en: `Activity ${index}`,
      planned_duration_minutes: 120,
      planned_duration_label: 'Suggested two hours',
      operator_duration_minutes: 90,
      duration_notes: 'Program note',
      booking_url: 'https://example.com/booking',
      public_contact: 'Public contact',
      booking_status: 'link_checked',
      booking_notes: 'Date not confirmed',
      facility_capacity: 20,
      group_reservation: 'Reserve together',
      group_discount: 'No verified discount',
      group_simultaneous_use: 'Ten places',
      english_website_url: 'https://example.com/en',
      english_staff: 'on_request',
      english_program: 'available',
      english_notes: 'Ask the operator',
      image_url: '/trip/photos/owned-image.webp',
      image_rights: 'owned',
      image_caption: `Saved caption ${index}`,
      image_attribution: 'Saved photographer credit',
      image_reference_urls: ['https://example.com/photo'],
      youtube_video_urls: ['https://youtu.be/dQw4w9WgXcQ'],
      youtube_search_url: 'https://www.youtube.com/results?search_query=Korea',
      youtube_channel_url: 'https://www.youtube.com/@VisitKorea',
      google_maps_url: 'https://maps.google.com/',
      google_rating: 4.5,
      google_review_count: 123,
      google_place_id: 'Place identifier',
      google_data_status: 'verified',
      driving_minutes: 45,
      latitude: 37.57,
      longitude: 126.98,
      coordinate_status: 'verified',
      map_latitude: 37.58,
      map_longitude: 126.99,
      map_coordinate_status: 'illustrative',
      shawn_comment: "Keep Shawn's edit",
      sun_comment: 'Keep Sun’s edit',
      source_urls: ['https://example.com/source'],
      source_evidence: 'Keep verification evidence',
      checked_at: '2026-11-14',
      published: index >= 3,
      is_illustrative: index < 3,
    });
    const values = historicalColumns.map((key) =>
      URL_LIST_FIELDS.includes(key)
        ? JSON.stringify(record[key])
        : BOOLEAN_FIELDS.includes(key)
          ? Number(record[key])
          : record[key],
    );
    database
      .prepare(
        `INSERT INTO activities (${historicalColumns.join(',')},created_at,updated_at) VALUES (${[...historicalColumns, 'created_at', 'updated_at'].map(() => '?').join(',')})`,
      )
      .run(...values, '2026-01-01T01:02:03.004Z', '2026-11-14T05:06:07.008Z');
  }
  const before = database.prepare('SELECT * FROM activities ORDER BY id').all();
  const columns = database.prepare('PRAGMA table_info(activities)').all();
  const indexes = database.prepare('PRAGMA index_list(activities)').all();
  assert.throws(
    () =>
      database
        .prepare(
          "UPDATE activities SET image_rights='official_reference' WHERE id='preserve-0'",
        )
        .run(),
    /CHECK constraint/,
  );
  database.exec(
    await readFile(
      new URL(
        '../db/migrations/0003_official_photo_references.sql',
        import.meta.url,
      ),
      'utf8',
    ),
  );
  assert.deepEqual(
    database.prepare('SELECT * FROM activities ORDER BY id').all(),
    before,
  );
  assert.deepEqual(
    database.prepare('PRAGMA table_info(activities)').all(),
    columns,
  );
  assert.deepEqual(
    database.prepare('PRAGMA index_list(activities)').all(),
    indexes,
  );
  database
    .prepare(
      "UPDATE activities SET image_rights='official_reference' WHERE id='preserve-0'",
    )
    .run();
  assert.equal(
    database
      .prepare("SELECT image_rights FROM activities WHERE id='preserve-0'")
      .get().image_rights,
    'official_reference',
  );
  assert.throws(
    () =>
      database
        .prepare(
          "UPDATE activities SET image_rights='pretend_licensed' WHERE id='preserve-0'",
        )
        .run(),
    /CHECK constraint/,
  );
  assert.deepEqual(
    database
      .prepare(
        "SELECT name FROM sqlite_master WHERE type='table' AND name NOT LIKE 'sqlite_%'",
      )
      .all()
      .map((row) => row.name),
    ['activities'],
  );
  database.close();
});

const dataset = JSON.parse(
  await readFile(
    new URL('../data/activities-70.json', import.meta.url),
    'utf8',
  ),
);
const originalManifest = JSON.parse(
  await readFile(
    new URL('../data/activity-photos.json', import.meta.url),
    'utf8',
  ),
);
function officialFixture() {
  const manifest = structuredClone(originalManifest);
  const assignment = manifest.activities.find((record) =>
    record.id.startsWith('wellness-'),
  );
  const photo = {
    key: 'official-clinic-fixture',
    image_url: 'https://clinic.example/media/actual-clinic.jpg',
    originalUrl: 'https://clinic.example/media/actual-clinic.jpg',
    downloadUrl: 'https://clinic.example/media/actual-clinic.jpg',
    sourcePage: 'https://clinic.example/facilities',
    licenseURL: 'https://clinic.example/facilities',
    author: 'Official Clinic',
    license: 'Official website reference; reuse license unverified',
    changes:
      'Direct reference to the original official image; no local redistribution.',
  };
  Object.assign(assignment, {
    photo_key: photo.key,
    image_url: photo.image_url,
    image_rights: 'official_reference',
    role: 'venue',
    caption: "Official Clinic's entrance",
    attribution: 'Official Clinic website · reuse license unverified',
  });
  manifest.photos.push(photo);
  return { manifest, assignment, photo };
}

await test('the photo importer preserves official-reference status and existing editor data without claiming a license', async () => {
  const { manifest, assignment, photo } = officialFixture();
  const sql = await buildActivityPhotoSql(manifest, dataset);
  const database = new DatabaseSync(':memory:');
  for (const migration of [
    '0001_activities.sql',
    '0002_history_and_photo_credits.sql',
    '0003_official_photo_references.sql',
  ])
    database.exec(
      await readFile(
        new URL('../db/migrations/' + migration, import.meta.url),
        'utf8',
      ),
    );
  const records = Array.isArray(dataset) ? dataset : dataset.activities;
  for (const record of records)
    database
      .prepare(
        'INSERT INTO activities(id,name_ko,name_en,shawn_comment,source_evidence,image_reference_urls) VALUES(?,?,?,?,?,?)',
      )
      .run(
        record.id,
        record.name_ko,
        'Preserve the edited title',
        'Preserve the personal comment',
        'Original verification evidence',
        JSON.stringify([
          'http://creativecommons.org/publicdomain/zero/1.0/deed.en',
          'https://example.com/existing-reference',
        ]),
      );
  database.exec(sql);
  for (const stored of database.prepare('SELECT * FROM activities').all()) {
    const input = Object.fromEntries(
      ACTIVITY_COLUMNS.map((key) => [key, stored[key]]),
    );
    for (const key of URL_LIST_FIELDS) input[key] = JSON.parse(input[key]);
    for (const key of BOOLEAN_FIELDS) input[key] = Boolean(input[key]);
    assert.ok(toActivity(parseActivity(input)).image, stored.id);
  }
  const row = database
    .prepare('SELECT * FROM activities WHERE id=?')
    .get(assignment.id);
  assert.equal(row.image_rights, 'official_reference');
  assert.equal(row.image_url, photo.image_url);
  assert.equal(row.image_caption, "Official Clinic's entrance");
  assert.equal(row.name_en, 'Preserve the edited title');
  assert.equal(row.shawn_comment, 'Preserve the personal comment');
  assert.match(row.source_evidence, /^Original verification evidence/);
  assert.match(
    row.source_evidence,
    /Official website reference · reuse license unverified/,
  );
  assert.doesNotMatch(
    row.source_evidence,
    /License: https:\/\/clinic\.example/,
  );
  assert.deepEqual(
    JSON.parse(row.image_reference_urls).sort(),
    [
      'http://creativecommons.org/publicdomain/zero/1.0/deed.en',
      'https://example.com/existing-reference',
      photo.sourcePage,
    ].sort(),
  );
  const before = database.prepare('SELECT * FROM activities ORDER BY id').all();
  database.exec(sql);
  assert.deepEqual(
    database.prepare('SELECT * FROM activities ORDER BY id').all(),
    before,
  );
  database.close();
});

await test('the photo importer rejects false rights claims and mismatched or unsafe references', async () => {
  for (const invalidate of [
    ({ assignment }) => {
      assignment.image_rights = 'licensed';
    },
    ({ assignment }) => {
      assignment.image_rights = 'owned';
    },
    ({ assignment }) => {
      assignment.attribution = 'Official Clinic website';
    },
    ({ photo }) => {
      photo.sourcePage = photo.licenseURL =
        'https://commons.wikimedia.org/wiki/File:Clinic.jpg';
    },
    ({ photo }) => {
      photo.sourcePage = photo.licenseURL = 'http://clinic.example/facilities';
    },
    ({ photo, assignment }) => {
      assignment.image_url = photo.image_url =
        'https://other.example/not-the-recorded-image.jpg';
    },
    ({ photo, assignment }) => {
      assignment.image_url = photo.image_url = '/trip/photos/../private.webp';
    },
  ]) {
    const fixture = officialFixture();
    invalidate(fixture);
    await assert.rejects(buildActivityPhotoSql(fixture.manifest, dataset));
  }
});

await test('owned local photos keep their explicit ownership without requiring Commons provenance', async () => {
  const manifest = structuredClone(originalManifest);
  const assignment = manifest.activities.find(
    (record) => record.image_rights === 'licensed',
  );
  const original = manifest.photos.find(
    (photo) => photo.key === assignment.photo_key,
  );
  const photo = {
    ...original,
    key: 'owned-photo-fixture',
    sourcePage: 'https://owner.example/portfolio',
    licenseURL: 'https://owner.example/ownership',
    author: 'Example photographer',
    license: 'Owned by Example photographer',
  };
  Object.assign(assignment, {
    photo_key: photo.key,
    image_rights: 'owned',
    attribution: 'Example photographer · owned image',
  });
  manifest.photos.push(photo);
  const sql = await buildActivityPhotoSql(manifest, dataset);
  const database = new DatabaseSync(':memory:');
  for (const migration of [
    '0001_activities.sql',
    '0002_history_and_photo_credits.sql',
    '0003_official_photo_references.sql',
  ])
    database.exec(
      await readFile(
        new URL('../db/migrations/' + migration, import.meta.url),
        'utf8',
      ),
    );
  database
    .prepare('INSERT INTO activities(id,name_ko,name_en) VALUES(?,?,?)')
    .run(assignment.id, assignment.name_ko, 'Preserved name');
  database.exec(sql);
  const row = database
    .prepare('SELECT image_rights,name_en FROM activities WHERE id=?')
    .get(assignment.id);
  assert.equal(row.image_rights, 'owned');
  assert.equal(row.name_en, 'Preserved name');
  database.close();
});
