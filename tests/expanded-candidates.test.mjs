import assert from 'node:assert/strict';
import test from 'node:test';
import { readFile, readdir } from 'node:fs/promises';
import { DatabaseSync } from 'node:sqlite';
import { createHash } from 'node:crypto';
import { buildExpandedImportSql } from '../scripts/import-expanded-candidates.mjs';

await test('thirty expanded candidates add diverse food, nightlife, shopping and experiences with real local photos without overwriting an edited card', async () => {
  const rows = JSON.parse(
    await readFile(
      new URL('../data/expanded-candidates-2026-11.json', import.meta.url),
      'utf8',
    ),
  );
  const manifest = JSON.parse(
    await readFile(
      new URL(
        '../data/expanded-candidate-photos-2026-11.json',
        import.meta.url,
      ),
      'utf8',
    ),
  );
  const { photos, coordinates } = manifest;
  const sql = buildExpandedImportSql(rows);
  assert.equal(photos.length, 29);
  assert.equal(coordinates.length, 30);
  assert.equal(new Set(coordinates.map((pin) => pin.placeId)).size, 30);
  const existing = (
    await Promise.all(
      [
        'activities-70.json',
        'extra-food-2026-11.json',
        'regional-candidates-2026-11.json',
      ].map(async (file) =>
        JSON.parse(
          await readFile(new URL('../data/' + file, import.meta.url), 'utf8'),
        ),
      ),
    )
  ).flat();
  for (const row of rows) {
    assert.ok(
      !existing.some(
        (card) => card.id === row.id || card.name_ko === row.name_ko,
      ),
      'Expanded candidates must not duplicate an existing card.',
    );
    const pin = coordinates.find((pin) => pin.id === row.id);
    assert.equal(pin.latitude, row.latitude);
    assert.equal(pin.longitude, row.longitude);
    assert.match(pin.sourcePage, /^https:\/\/place\.map\.kakao\.com\/\d+$/);
  }
  assert.deepEqual(
    rows.filter((row) => !row.image_url).map((row) => row.id),
    ['food-wiir-philadelphia'],
  );
  const db = new DatabaseSync(':memory:');
  try {
    const migrations = new URL('../db/migrations/', import.meta.url);
    for (const file of (await readdir(migrations))
      .filter((file) => file.endsWith('.sql'))
      .sort((a, b) => a.localeCompare(b)))
      db.exec(await readFile(new URL(file, migrations), 'utf8'));
    db.exec(
      "INSERT INTO activities (id,name_ko,name_en,shawn_comment) VALUES ('manual','직접 입력','Manual card','Keep this');",
    );
    db.exec(sql);
    assert.equal(
      db.prepare('SELECT COUNT(*) AS count FROM activities').get().count,
      31,
    );
    assert.equal(rows.filter((r) => r.category_id === 'food').length, 14);
    assert.equal(rows.filter((r) => r.category_id === 'shopping').length, 3);
    assert.equal(rows.filter((r) => r.category_id === 'experience').length, 10);
    assert.equal(rows.filter((r) => r.category_id === 'nightlife').length, 3);
    assert.ok(rows.some((r) => r.region_id === 'gyeongbuk'));
    assert.ok(rows.some((r) => r.region_id === 'jeonbuk'));
    for (const row of rows) {
      assert.equal(row.coordinate_status, 'verified');
      assert.equal(row.driving_minutes, null);
      assert.equal(row.shawn_rating, null);
      assert.equal(row.sun_comment, null);
      assert.equal(row.google_rating, null);
      assert.ok(
        row.card_location && !/\b(?:dong|myeon|eup)\b/i.test(row.card_location),
      );
      const saved = db
        .prepare('SELECT card_location,shawn_rating FROM activities WHERE id=?')
        .get(row.id);
      assert.equal(saved.card_location, row.card_location);
      assert.equal(saved.shawn_rating, null);
      if (!row.image_url) {
        assert.equal(row.image_rights, 'unverified');
        assert.match(row.source_evidence, /Photo gap/);
        continue;
      }
      const photo = photos.find((p) => p.id === row.id);
      assert.ok(photo?.subjectEvidence.visually_confirmed);
      const bytes = await readFile(
        new URL('../public' + row.image_url, import.meta.url),
      );
      assert.equal(bytes.toString('ascii', 0, 4), 'RIFF');
      assert.equal(bytes.toString('ascii', 8, 12), 'WEBP');
      assert.equal(
        createHash('sha256').update(bytes).digest('hex'),
        photo.sha256,
      );
      assert.ok(photo.width >= 300 && photo.height >= 300);
      assert.equal(photo.coordinate.latitude, row.latitude);
      assert.equal(photo.coordinate.longitude, row.longitude);
      assert.equal(photo.image_url, row.image_url);
      assert.equal(
        photo.role,
        row.category_id === 'food' ? 'main_menu' : 'venue',
      );
    }
    db.exec(
      "UPDATE activities SET shawn_comment='Keep regional edit',shawn_rating=5 WHERE id='food-wiir-philadelphia';",
    );
    db.exec(sql);
    assert.equal(
      db.prepare('SELECT COUNT(*) AS count FROM activities').get().count,
      31,
    );
    assert.deepEqual(
      {
        ...db
          .prepare(
            "SELECT shawn_comment,shawn_rating FROM activities WHERE id='food-wiir-philadelphia'",
          )
          .get(),
      },
      { shawn_comment: 'Keep regional edit', shawn_rating: 5 },
    );
    assert.equal(
      db.prepare("SELECT shawn_comment FROM activities WHERE id='manual'").get()
        .shawn_comment,
      'Keep this',
    );
    assert.throws(() => buildExpandedImportSql([...rows, rows[0]]));
    assert.throws(() =>
      buildExpandedImportSql(
        rows.map((row, index) =>
          index ? row : { ...row, id: 'food-unrelated-business' },
        ),
      ),
    );
    assert.throws(() =>
      buildExpandedImportSql(
        rows.map((r, i) => (i ? r : { ...r, coordinate_status: 'unassigned' })),
      ),
    );
  } finally {
    db.close();
  }
});
