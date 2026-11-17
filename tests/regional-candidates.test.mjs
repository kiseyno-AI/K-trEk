import assert from 'node:assert/strict';
import test from 'node:test';
import { readFile, readdir } from 'node:fs/promises';
import { DatabaseSync } from 'node:sqlite';
import { createHash } from 'node:crypto';
import { buildRegionalImportSql } from '../scripts/import-regional-candidates.mjs';

await test('nine regional candidates add balanced day trips with real local photos without overwriting an edited card', async () => {
  const rows = JSON.parse(
    await readFile(
      new URL('../data/regional-candidates-2026-11.json', import.meta.url),
      'utf8',
    ),
  );
  const photos = JSON.parse(
    await readFile(
      new URL(
        '../data/regional-candidate-photos-2026-11.json',
        import.meta.url,
      ),
      'utf8',
    ),
  ).photos;
  const sql = buildRegionalImportSql(rows);
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
      10,
    );
    assert.equal(rows.filter((r) => r.category_id === 'food').length, 3);
    assert.equal(rows.filter((r) => r.category_id === 'nature').length, 3);
    assert.equal(rows.filter((r) => r.category_id === 'experience').length, 3);
    assert.deepEqual(
      [...new Set(rows.map((r) => r.region_id))].sort((a, b) =>
        a.localeCompare(b),
      ),
      ['gangwon', 'gyeonggi', 'incheon'],
    );
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
      assert.ok(photo.width >= 500 && photo.height >= 400);
    }
    const nami = rows.find((r) => r.id === 'nature-nami-island');
    assert.match(nami.area_description, /mainland Gapyeong Wharf/);
    assert.match(nami.source_evidence, /ferry/);
    db.exec(
      "UPDATE activities SET shawn_comment='Keep regional edit',shawn_rating=5 WHERE id='food-bonsuwon-galbi-main';",
    );
    db.exec(sql);
    assert.equal(
      db.prepare('SELECT COUNT(*) AS count FROM activities').get().count,
      10,
    );
    assert.deepEqual(
      {
        ...db
          .prepare(
            "SELECT shawn_comment,shawn_rating FROM activities WHERE id='food-bonsuwon-galbi-main'",
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
    assert.throws(() => buildRegionalImportSql([...rows, rows[0]]));
    assert.throws(() =>
      buildRegionalImportSql(
        rows.map((r, i) => (i ? r : { ...r, coordinate_status: 'unassigned' })),
      ),
    );
  } finally {
    db.close();
  }
});
