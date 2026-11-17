import assert from 'node:assert/strict';
import test from 'node:test';
import { readFile } from 'node:fs/promises';
import { DatabaseSync } from 'node:sqlite';
import { parseActivity, toActivity } from '../lib/activities.ts';

const identity = {
  id: 'host-review',
  name_ko: '테스트 장소',
  name_en: 'Test place',
  region_id: 'seoul',
};

void test('host ratings and comments are separate editable facts and compact card location preserves the full location', () => {
  const record = parseActivity({
    ...identity,
    region_name: 'Apgujeong, Gangnam, Seoul',
    card_location: 'Seoul · Gangnam-gu',
    shawn_rating: 5,
    sun_rating: 3,
    shawn_comment: 'A memorable meal. Reserve a table ahead.',
    sun_comment: 'A relaxed setting. I would visit again.',
  });
  const card = toActivity(record);
  assert.equal(card.cardLocation, 'Seoul · Gangnam-gu');
  assert.equal(card.region, 'Apgujeong, Gangnam, Seoul');
  assert.equal(card.details.shawn_rating, 5);
  assert.equal(card.details.sun_rating, 3);
  const empty = parseActivity(identity);
  assert.equal(empty.shawn_rating, null);
  assert.equal(empty.sun_rating, null);
  assert.equal(toActivity(empty).cardLocation, 'Seoul');
  for (const key of ['shawn_rating', 'sun_rating']) {
    for (const value of [0, 6, 2.5, -1, '5'])
      assert.throws(() => parseActivity({ ...identity, [key]: value }));
    assert.equal(parseActivity({ ...identity, [key]: '' })[key], null);
  }
});

void test('the additive review migration preserves every existing field and starts new ratings empty', async () => {
  const db = new DatabaseSync(':memory:');
  for (const file of [
    '0001_activities.sql',
    '0002_history_and_photo_credits.sql',
    '0003_official_photo_references.sql',
  ])
    db.exec(
      await readFile(
        new URL('../db/migrations/' + file, import.meta.url),
        'utf8',
      ),
    );
  db.exec(
    "INSERT INTO activities(id,name_ko,name_en,shawn_comment,sun_comment,created_at) VALUES('saved','보존','Preserved','Keep Shawn','Keep Sun','2026-01-01')",
  );
  const before = db.prepare("SELECT * FROM activities WHERE id='saved'").get();
  db.exec(
    await readFile(
      new URL(
        '../db/migrations/0004_host_reviews_and_card_location.sql',
        import.meta.url,
      ),
      'utf8',
    ),
  );
  const after = db.prepare("SELECT * FROM activities WHERE id='saved'").get();
  assert.equal(after.shawn_rating, null);
  assert.equal(after.sun_rating, null);
  assert.equal(after.card_location, null);
  for (const key of ['shawn_rating', 'sun_rating', 'card_location'])
    delete after[key];
  assert.deepEqual(after, before);
  db.exec(
    "UPDATE activities SET shawn_rating=5,sun_rating=2,card_location='Seoul · Jung-gu' WHERE id='saved'",
  );
  assert.equal(
    db.prepare("SELECT shawn_rating FROM activities WHERE id='saved'").get()
      .shawn_rating,
    5,
  );
  assert.throws(() =>
    db.exec("UPDATE activities SET sun_rating=6 WHERE id='saved'"),
  );
  assert.throws(() =>
    db.exec("UPDATE activities SET shawn_rating=2.5 WHERE id='saved'"),
  );
  db.close();
});
