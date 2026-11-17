import assert from 'node:assert/strict';
import { test } from 'node:test';
import { parseActivity, toActivity } from '../lib/activities.ts';
import { readFile } from 'node:fs/promises';
import { DatabaseSync } from 'node:sqlite';
import { adminAllowed, readAdminJson } from '../lib/admin-access.ts';
import { activitySeeds } from '../lib/activity-seed.ts';

const input = {
  id: 'sample-place',
  name_ko: '테스트 장소',
  name_en: 'Sample place',
  category_id: 'culture',
  region_id: 'seoul',
};

void test('a place keeps unverified details empty until an editor supplies them', () => {
  const record = parseActivity(input);
  const card = toActivity(record);
  assert.equal(card.title, 'Sample place');
  assert.equal(card.travelMinutes, null);
  assert.equal(card.mapFocus, null);
  assert.equal(card.image, null);
  assert.equal(card.quote, null);
});

void test('the single activities table persists Unicode, unknown values and structured links', async () => {
  const database = new DatabaseSync(':memory:');
  database.exec(
    await readFile(
      new URL('../db/migrations/0001_activities.sql', import.meta.url),
      'utf8',
    ),
  );
  database
    .prepare(
      'INSERT INTO activities (id, name_ko, name_en, category_id, region_id, source_urls) VALUES (?, ?, ?, ?, ?, ?)',
    )
    .run(
      'sample',
      "서울의 '시장'",
      'Market',
      'food',
      'seoul',
      JSON.stringify(['https://example.com/source']),
    );
  const row = database
    .prepare('SELECT * FROM activities WHERE id = ?')
    .get('sample');
  assert.equal(row.name_ko, "서울의 '시장'");
  assert.equal(row.driving_minutes, null);
  assert.equal(row.latitude, null);
  assert.equal(row.shawn_comment, null);
  assert.deepEqual(JSON.parse(row.source_urls), ['https://example.com/source']);
  assert.equal(
    database
      .prepare(
        "SELECT count(*) AS total FROM sqlite_master WHERE type = 'table' AND name NOT LIKE 'sqlite_%'",
      )
      .get().total,
    1,
  );
  database.close();
});

void test('verified coordinates and rights-cleared images are distinct from illustrative placeholders', () => {
  const unknown = parseActivity({
    ...input,
    latitude: 37.57,
    longitude: 126.98,
    coordinate_status: 'unverified',
  });
  assert.equal(toActivity(unknown).mapFocus, null);
  const verified = parseActivity({
    ...unknown,
    coordinate_status: 'verified',
    image_url: 'https://example.com/owned.jpg',
    image_rights: 'owned',
  });
  assert.deepEqual(toActivity(verified).mapFocus, [126.98, 37.57]);
  assert.equal(toActivity(verified).mapIsIllustrative, false);
  assert.equal(toActivity(verified).image, 'https://example.com/owned.jpg');
  assert.throws(
    () =>
      parseActivity({
        ...input,
        image_url: 'https://example.com/unverified.jpg',
      }),
    /reuse rights/,
  );
  assert.throws(
    () => parseActivity({ ...input, map_latitude: 37.57 }),
    /both latitude/,
  );
  assert.throws(
    () =>
      parseActivity({
        ...input,
        latitude: 91,
        longitude: 126.98,
        coordinate_status: 'verified',
      }),
    /allowed range/,
  );
});

void test('invalid fields and executable URLs are rejected without erasing unknown values', () => {
  for (const change of [
    { category_id: 'anything' },
    { region_id: 'not-a-region' },
    { booking_url: 'javascript:alert(1)' },
    { source_urls: ['data:text/html,hello'] },
    { google_rating: 6 },
    { driving_minutes: -1 },
    { unexpected: 'field' },
    { location_type: 'area' },
    { checked_at: '2026-02-30' },
  ])
    assert.throws(() => parseActivity({ ...input, ...change }));
  assert.equal(
    parseActivity({ ...input, driving_minutes: '', shawn_comment: '' })
      .driving_minutes,
    null,
  );
  assert.equal(
    parseActivity({ ...input, shawn_comment: '' }).shawn_comment,
    null,
  );
});

void test('exactly three illustrative seeds keep all unverified facts and personal comments empty', () => {
  assert.equal(activitySeeds.length, 3);
  for (const seed of activitySeeds) {
    const record = parseActivity(seed);
    assert.equal(record.is_illustrative, true);
    for (const key of [
      'latitude',
      'longitude',
      'driving_minutes',
      'google_rating',
      'google_review_count',
      'google_place_id',
      'shawn_comment',
      'sun_comment',
      'checked_at',
    ])
      assert.equal(record[key], null);
    assert.equal(record.map_coordinate_status, 'illustrative');
    assert.equal(toActivity(record).mapIsIllustrative, true);
  }
});

void test('actual YouTube video links cannot be replaced by search, channel or unrelated links', () => {
  const videos = [
    'https://www.youtube.com/watch?v=dQw4w9WgXcQ&t=30',
    'https://m.youtube.com/shorts/dQw4w9WgXcQ',
    'https://www.youtube.com/embed/dQw4w9WgXcQ',
    'https://youtu.be/dQw4w9WgXcQ?si=example',
  ];
  const search = 'https://www.youtube.com/results?search_query=Korea';
  const channel = 'https://www.youtube.com/@VisitKorea';
  const record = parseActivity({
    ...input,
    youtube_video_urls: videos,
    youtube_search_url: search,
    youtube_channel_url: channel,
  });
  assert.deepEqual(record.youtube_video_urls, videos);
  assert.equal(record.youtube_search_url, search);
  assert.equal(record.youtube_channel_url, channel);
  assert.deepEqual(parseActivity(input).youtube_video_urls, []);
  for (const link of [
    search,
    channel,
    'https://www.youtube.com/channel/UCexample',
    'https://example.com/watch?v=dQw4w9WgXcQ',
    'https://youtube.com.evil.test/watch?v=dQw4w9WgXcQ',
    'https://www.youtube.com/watch',
    'https://youtu.be/not-a-video-id',
    'https://www.youtube.com/embed/videoseries?list=example',
    'https://www.youtube.com/embed/live_stream?channel=example',
  ]) {
    assert.throws(
      () => parseActivity({ ...input, youtube_video_urls: [link] }),
      /Actual YouTube videos/,
    );
  }
});

void test('local editing does not authorize a hosted or cross-origin writer', async () => {
  assert.equal(
    adminAllowed(new Request('http://localhost:3000/admin'), {
      development: true,
    }),
    true,
  );
  assert.equal(
    adminAllowed(new Request('https://localhost.evil.test/admin'), {
      development: true,
    }),
    false,
  );
  assert.equal(
    adminAllowed(new Request('http://localhost:3000/admin'), {
      development: false,
    }),
    false,
  );
  const signed = new Request('https://trip.example/admin', {
    headers: {
      'oai-authenticated-user-email': 'Editor@Example.com',
      'oai-authenticated-user-id': 'stable-site-user',
    },
  });
  assert.equal(
    adminAllowed(signed, { development: false, emails: 'editor@example.com' }),
    true,
  );
  assert.equal(
    adminAllowed(signed, { development: false, emails: 'someone@example.com' }),
    false,
  );
  await assert.rejects(
    readAdminJson(
      new Request('http://localhost:3000/api/activities', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Origin: 'https://other.example',
        },
        body: '{}',
      }),
    ),
    /Cross-origin/,
  );
  await assert.rejects(
    readAdminJson(
      new Request('http://localhost:3000/api/activities', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ text: 'x'.repeat(70000) }),
      }),
    ),
    /too large/,
  );
  assert.deepEqual(
    await readAdminJson(
      new Request('http://localhost:3000/api/activities', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Origin: 'http://localhost:3000',
        },
        body: JSON.stringify(input),
      }),
    ),
    input,
  );
});

void test('a verified venue pin takes priority over an old illustrative map position', () => {
  const card = toActivity(
    parseActivity({
      ...input,
      latitude: 37.5658,
      longitude: 126.9769,
      coordinate_status: 'verified',
      map_latitude: 37.57,
      map_longitude: 126.98,
      map_coordinate_status: 'illustrative',
    }),
  );
  assert.deepEqual(card.mapFocus, [126.9769, 37.5658]);
  assert.equal(card.mapIsIllustrative, false);
});
