import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { DatabaseSync } from 'node:sqlite';
import { buildExtraFoodImportSql } from '../scripts/import-extra-food.mjs';

await test('extra restaurant import adds five complete cards and preserves existing edits on rerun', async () => {
  const rows = JSON.parse(
    await readFile(
      new URL('../data/extra-food-2026-11.json', import.meta.url),
      'utf8',
    ),
  );
  const sql = buildExtraFoodImportSql(rows);
  const db = new DatabaseSync(':memory:');
  try {
    for (const migration of [
      '0001_activities.sql',
      '0002_history_and_photo_credits.sql',
      '0003_official_photo_references.sql',
      '0004_host_reviews_and_card_location.sql',
    ])
      db.exec(
        await readFile(
          new URL('../db/migrations/' + migration, import.meta.url),
          'utf8',
        ),
      );
    db.exec(
      "INSERT INTO activities (id,name_ko,name_en,shawn_comment) VALUES ('manual','직접 입력','Manual card','Keep this');",
    );
    db.exec(sql);
    assert.equal(
      db.prepare('SELECT COUNT(*) AS count FROM activities').get().count,
      6,
    );
    for (const row of rows) {
      assert.equal(row.category_id, 'food');
      assert.equal(row.coordinate_status, 'verified');
      assert.equal(row.booking_status, 'unknown');
      assert.equal(row.english_staff, 'unknown');
      assert.equal(row.google_rating, null);
      assert.equal(row.google_place_id, null);
      assert.equal(row.planned_duration_minutes, null);
      assert.match(row.image_url, /^\/trip\/photos\/food-extra-[a-z-]+\.webp$/);
      assert.ok(
        (await readFile(new URL('../public' + row.image_url, import.meta.url)))
          .length > 1000,
      );
    }
    db.exec(
      "UPDATE activities SET shawn_comment='Keep my restaurant edit' WHERE id='food-hadongkwan-myeongdong';",
    );
    db.exec(sql);
    assert.equal(
      db.prepare('SELECT COUNT(*) AS count FROM activities').get().count,
      6,
    );
    assert.equal(
      db.prepare("SELECT shawn_comment FROM activities WHERE id='manual'").get()
        .shawn_comment,
      'Keep this',
    );
    assert.equal(
      db
        .prepare(
          "SELECT shawn_comment FROM activities WHERE id='food-hadongkwan-myeongdong'",
        )
        .get().shawn_comment,
      'Keep my restaurant edit',
    );
    assert.throws(() => buildExtraFoodImportSql([...rows, rows[0]]));
    assert.throws(() =>
      buildExtraFoodImportSql(
        rows.map((row, i) => (i ? row : { ...row, category_id: 'culture' })),
      ),
    );
  } finally {
    db.close();
  }
});
