import assert from 'node:assert/strict';
import test from 'node:test';
import { readFile, readdir } from 'node:fs/promises';
import { DatabaseSync } from 'node:sqlite';
import { buildFoodMenuPhotoSql } from '../scripts/import-food-menu-photos.mjs';

await test('menu photographs update all fifteen food cards without changing editorial data or unrelated records', async () => {
  const manifest = JSON.parse(
    await readFile(
      new URL('../data/food-menu-photos-2026-11.json', import.meta.url),
      'utf8',
    ),
  );
  const activities = (
    await Promise.all(
      ['activities-70.json', 'extra-food-2026-11.json'].map(async (name) =>
        JSON.parse(
          await readFile(new URL('../data/' + name, import.meta.url), 'utf8'),
        ),
      ),
    )
  ).flat();
  const sql = await buildFoodMenuPhotoSql(manifest, activities);
  const db = new DatabaseSync(':memory:');
  try {
    const migrations = (
      await readdir(new URL('../db/migrations/', import.meta.url))
    )
      .filter((name) => name.endsWith('.sql'))
      .sort();
    for (const name of migrations)
      db.exec(
        await readFile(
          new URL('../db/migrations/' + name, import.meta.url),
          'utf8',
        ),
      );
    const insert = db.prepare(
      "INSERT INTO activities (id,name_ko,name_en,category_id,summary_en,shawn_comment,sun_comment,latitude,longitude,coordinate_status,source_evidence,image_reference_urls) VALUES (?,?,?,'food','Keep editorial','Keep Shawn','Keep Sun',37.57,126.98,'verified','Keep source evidence','[\"https://example.com/old-photo\"]')",
    );
    for (const photo of manifest.photos)
      insert.run(photo.id, photo.name_ko, photo.id);
    const columns = db
      .prepare('PRAGMA table_info(activities)')
      .all()
      .map((column) => column.name);
    if (columns.includes('shawn_rating'))
      db.exec('UPDATE activities SET shawn_rating=4, sun_rating=5');
    db.exec(
      "INSERT INTO activities (id,name_ko,name_en,category_id,image_url,shawn_comment) VALUES ('manual-other','별도 기록','Manual other','nature',NULL,'Keep this too')",
    );
    const before = db.prepare('SELECT * FROM activities ORDER BY id').all();
    db.exec(sql);
    const after = db.prepare('SELECT * FROM activities ORDER BY id').all();
    const photoFields = new Set([
      'image_url',
      'image_rights',
      'image_caption',
      'image_attribution',
      'image_reference_urls',
    ]);
    const withoutPhotos = (row) =>
      Object.fromEntries(
        Object.entries(row).filter(([key]) => !photoFields.has(key)),
      );
    assert.deepEqual(after.map(withoutPhotos), before.map(withoutPhotos));
    assert.equal(after.length, 16);
    for (const photo of manifest.photos) {
      const row = after.find((row) => row.id === photo.id);
      assert.equal(row.image_url, photo.image_url);
      assert.equal(JSON.parse(row.image_reference_urls)[0], photo.sourcePage);
      assert.ok(
        JSON.parse(row.image_reference_urls).includes(
          'https://example.com/old-photo',
        ),
      );
    }
    db.exec(sql);
    assert.deepEqual(
      db.prepare('SELECT * FROM activities ORDER BY id').all(),
      after,
    );
    assert.equal(
      db
        .prepare("SELECT image_url FROM activities WHERE id='manual-other'")
        .get().image_url,
      null,
    );
    await assert.rejects(() =>
      buildFoodMenuPhotoSql(
        { ...manifest, photos: manifest.photos.slice(1) },
        activities,
      ),
    );
    await assert.rejects(() =>
      buildFoodMenuPhotoSql(
        {
          ...manifest,
          photos: manifest.photos.map((p, i) =>
            i ? p : { ...p, image_rights: 'licensed' },
          ),
        },
        activities,
      ),
    );
    await assert.rejects(() =>
      buildFoodMenuPhotoSql(
        {
          ...manifest,
          photos: manifest.photos.map((p, i) =>
            i ? p : { ...p, image_url: '/trip/photos/../private.webp' },
          ),
        },
        activities,
      ),
    );
    await assert.rejects(() =>
      buildFoodMenuPhotoSql(
        {
          ...manifest,
          photos: manifest.photos.map((p, i) =>
            i ? p : { ...p, name_ko: 'Wrong identity' },
          ),
        },
        activities,
      ),
    );
  } finally {
    db.close();
  }
});
