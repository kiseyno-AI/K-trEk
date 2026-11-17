import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { DatabaseSync } from 'node:sqlite';
import {
  buildActivityImportSql,
  IMPORT_CATEGORIES,
} from '../scripts/import-activities.mjs';
import { activitySeeds } from '../lib/activity-seed.ts';
import {
  ACTIVITY_COLUMNS,
  BOOLEAN_FIELDS,
  URL_LIST_FIELDS,
  parseActivity,
} from '../lib/activities.ts';

const schema = await readFile(
  new URL('../db/migrations/0001_activities.sql', import.meta.url),
  'utf8',
);

await test('upgrade keeps an existing card and permits the history category plus photo credits', async () => {
  const db = new DatabaseSync(':memory:');
  db.exec(schema);
  db.exec(
    "INSERT INTO activities (id,name_ko,name_en,shawn_comment,created_at) VALUES ('manual','내 카드','My card','Keep my edit','2026-01-01');",
  );
  const before = db.prepare("SELECT * FROM activities WHERE id='manual'").get();
  db.exec(
    await readFile(
      new URL(
        '../db/migrations/0002_history_and_photo_credits.sql',
        import.meta.url,
      ),
      'utf8',
    ),
  );
  const after = db.prepare("SELECT * FROM activities WHERE id='manual'").get();
  delete after.image_caption;
  delete after.image_attribution;
  assert.deepEqual(after, before);
  db.exec(
    "INSERT INTO activities (id,name_ko,name_en,category_id,image_caption,image_attribution) VALUES ('history-test','역사','History','history','Context image','Photographer / CC BY');",
  );
  assert.equal(
    db.prepare("SELECT shawn_comment FROM activities WHERE id='manual'").get()
      .shawn_comment,
    'Keep my edit',
  );
  assert.equal(
    db.prepare("SELECT created_at FROM activities WHERE id='manual'").get()
      .created_at,
    '2026-01-01',
  );
  assert.equal(
    db
      .prepare("SELECT image_caption FROM activities WHERE id='history-test'")
      .get().image_caption,
    'Context image',
  );
  assert.deepEqual(
    db
      .prepare(
        "SELECT name FROM sqlite_master WHERE type='table' AND name NOT LIKE 'sqlite_%'",
      )
      .all()
      .map((row) => row.name),
    ['activities'],
  );
  assert.equal(
    parseActivity({
      id: 'history-test',
      name_ko: '역사',
      name_en: 'History',
      category_id: 'history',
      image_url: '/trip/photos/history-test.webp',
      image_rights: 'licensed',
      image_caption: 'Context image',
      image_attribution: 'Photographer / CC BY',
    }).image_url,
    '/trip/photos/history-test.webp',
  );
  assert.throws(() =>
    parseActivity({
      id: 'bad-path',
      name_ko: '역사',
      name_en: 'History',
      image_url: '/trip/photos/../secrets.png',
      image_rights: 'licensed',
    }),
  );
  db.close();
});

const dataset = JSON.parse(
  await readFile(
    new URL('../data/activities-70.json', import.meta.url),
    'utf8',
  ),
);

await test('the supplied tables become exactly seventy honest, source-preserving cards', () => {
  const records = dataset.map(parseActivity);
  assert.equal(records.length, 70);
  assert.equal(new Set(records.map((record) => record.id)).size, 70);
  for (const category of IMPORT_CATEGORIES)
    assert.equal(
      records.filter((record) => record.category_id === category).length,
      10,
    );
  for (const record of records) {
    assert.equal(record.published, true);
    assert.equal(record.is_illustrative, false);
    for (const key of [
      'google_rating',
      'google_review_count',
      'google_place_id',
      'driving_minutes',
      'map_latitude',
      'map_longitude',
      'shawn_comment',
      'sun_comment',
      'checked_at',
      'image_url',
      'image_caption',
      'image_attribution',
      'preview_image_url',
    ])
      assert.equal(
        record[key],
        null,
        `${record.id}: ${key} must remain unknown`,
      );
    assert.equal(record.coordinate_status, 'verified');
    assert.ok(
      Number.isFinite(record.latitude) && Number.isFinite(record.longitude),
    );
    assert.equal(record.map_coordinate_status, 'unassigned');
    assert.equal(record.booking_status, 'unknown');
    assert.equal(record.google_data_status, 'unverified');
    assert.deepEqual(record.youtube_video_urls, []);
    assert.ok(
      record.name_en &&
        record.summary_en &&
        record.activity_en &&
        record.area_description,
    );
    assert.ok(record.source_urls.length > 0);
    assert.match(record.source_evidence, /user-supplied research/i);
    for (const link of [
      ...record.source_urls,
      ...record.image_reference_urls,
      record.booking_url,
      record.english_website_url,
    ].filter(Boolean))
      assert.equal(new URL(link).protocol, 'https:');
    if (record.category_id === 'wellness') {
      assert.equal(record.english_staff, 'unknown');
      assert.equal(record.english_program, 'unknown');
      assert.equal(record.planned_duration_minutes, null);
      assert.equal(record.planned_duration_label, null);
      assert.match(record.source_evidence, /not been independently verified/);
      assert.ok(record.address);
    }
  }
  const byId = Object.fromEntries(records.map((record) => [record.id, record]));
  assert.equal(byId['food-hwa-hae-dang'].public_contact, '02-785-4422');
  assert.equal(byId['culture-gugak-saturday'].operator_duration_minutes, 80);
  assert.equal(
    byId['culture-gugak-saturday'].planned_duration_label,
    '110–140 min',
  );
  assert.equal(byId['experience-ongo-cooking'].operator_duration_minutes, 180);
  assert.equal(byId['experience-ongo-cooking'].english_program, 'available');
  assert.equal(byId['experience-1million-dance'].english_staff, 'available');
  assert.equal(byId['experience-1million-dance'].english_program, 'unknown');
  assert.equal(byId['experience-paju-dmz'].planned_duration_minutes, 360);
  assert.match(
    byId['experience-paju-dmz'].duration_notes,
    /round-trip travel from Seoul/,
  );
  assert.match(
    byId['history-naksan-city-wall'].area_description,
    /Hyehwamun.*Gwanghuimun.*3.2 km/,
  );
  assert.equal(
    new URL(byId['food-samwon-garden'].booking_url).searchParams.get(
      'service-target',
    ),
    'nmap',
  );
  assert.equal(
    new URL(byId['food-born-and-bred'].booking_url).searchParams.get(
      'operationType',
    ),
    'DINING_GLOBAL',
  );
  assert.equal(
    new URL(byId['wellness-cnp-dogok'].booking_url).searchParams.get('uid'),
    '28',
  );
  assert.match(
    byId['nature-banpo-hangang'].booking_notes,
    /November.*do not represent.*confirmed itinerary/,
  );
  assert.match(
    byId['experience-kiwoom-baseball'].group_simultaneous_use,
    /4\+4\+2.*three legitimate purchasers/,
  );
  assert.match(
    byId['nature-hwadam'].group_simultaneous_use,
    /Group reservations are not accepted/,
  );
});

await test('local import hides only illustrative samples and preserves every manual edit on rerun', async () => {
  const db = new DatabaseSync(':memory:');
  db.exec(schema);
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
  for (const input of activitySeeds) {
    const record = parseActivity(input);
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
    "INSERT INTO activities(id,name_ko,name_en,published) VALUES('my-card','직접 입력','Manual card',1)",
  );
  db.exec(buildActivityImportSql(dataset));
  assert.equal(
    db.prepare('SELECT count(*) AS n FROM activities WHERE published=1').get()
      .n,
    71,
  );
  assert.equal(
    db
      .prepare(
        "SELECT count(*) AS n FROM activities WHERE id IN ('temple','seoul','busan') AND published=0",
      )
      .get().n,
    3,
  );
  db.exec(
    "UPDATE activities SET name_en='My revised title', shawn_comment='Keep this', image_caption='My caption', published=0 WHERE id='food-samwon-garden'",
  );
  const before = db
    .prepare("SELECT * FROM activities WHERE id='food-samwon-garden'")
    .get();
  db.exec(buildActivityImportSql(dataset));
  assert.deepEqual(
    db.prepare("SELECT * FROM activities WHERE id='food-samwon-garden'").get(),
    before,
  );
  assert.equal(db.prepare('SELECT count(*) AS n FROM activities').get().n, 74);
  assert.equal(
    db.prepare("SELECT published FROM activities WHERE id='my-card'").get()
      .published,
    1,
  );
  assert.throws(() => buildActivityImportSql(dataset.slice(1)), /70 unique/);
  assert.throws(
    () => buildActivityImportSql([...dataset.slice(0, 69), dataset[0]]),
    /70 unique/,
  );
  db.close();
});
