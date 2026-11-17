import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { readFile, writeFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const root = fileURLToPath(new URL('../', import.meta.url));
const quote = (value) => `'${String(value).replaceAll("'", "''")}'`;
const https = (value) => {
  const url = new URL(value);
  assert.ok(
    url.protocol === 'https:' && !url.username && !url.password,
    'Photo references must be public HTTPS URLs.',
  );
  return url;
};

export async function buildFoodMenuPhotoSql(
  manifest,
  activities,
  assetRoot = root,
) {
  const expected = new Map(
    activities.filter((a) => a.category_id === 'food').map((a) => [a.id, a]),
  );
  assert.equal(
    expected.size,
    15,
    'Expected the fifteen preexisting food cards.',
  );
  assert.equal(
    manifest.photos.length,
    15,
    'Every preexisting food card needs a menu photo.',
  );
  assert.equal(
    new Set(manifest.photos.map((p) => p.id)).size,
    15,
    'Photo IDs must be unique.',
  );
  const updates = [];
  for (const p of manifest.photos) {
    assert.equal(
      expected.get(p.id)?.name_ko,
      p.name_ko,
      'Photo activity identity mismatch.',
    );
    assert.match(p.image_url, /^\/trip\/photos\/food-menu-[a-z0-9-]+\.webp$/);
    assert.equal(p.role, 'main_menu');
    assert.ok(
      p.menu_subject &&
        p.caption &&
        p.attribution &&
        p.author &&
        p.subjectEvidence?.visually_confirmed,
    );
    https(p.sourcePage);
    https(p.licenseURL);
    assert.ok(['licensed', 'official_reference'].includes(p.image_rights));
    if (p.image_rights === 'licensed') {
      assert.match(
        p.sourcePage,
        /^https:\/\/commons\.wikimedia\.org\/wiki\/File:/,
      );
      assert.doesNotMatch(p.license, /unverified/i);
    } else {
      assert.equal(p.licenseURL, p.sourcePage);
      assert.match(p.attribution, /reuse license unverified/i);
      assert.match(p.license, /reuse license unverified/i);
    }
    const bytes = await readFile(
      resolve(assetRoot, 'public', p.image_url.slice(1)),
    );
    assert.equal(bytes.subarray(0, 4).toString(), 'RIFF');
    assert.equal(bytes.subarray(8, 12).toString(), 'WEBP');
    assert.ok(bytes.length > 1000);
    assert.equal(bytes.length, p.bytes);
    assert.equal(createHash('sha256').update(bytes).digest('hex'), p.sha256);
    assert.ok(
      p.width >= 300 && p.height >= 250 && p.width <= 1200 && p.height <= 1200,
    );
    const refs = [...new Set([p.sourcePage, p.licenseURL])];
    const incoming = refs
      .map((u, i) => `SELECT ${i} AS priority, ${quote(u)} AS value`)
      .join(' UNION ALL ');
    const merged = `(SELECT json_group_array(value) FROM (SELECT value FROM (${incoming} UNION ALL SELECT 100 + key AS priority, value FROM json_each(image_reference_urls)) GROUP BY value ORDER BY MIN(priority)))`;
    updates.push(
      `UPDATE activities SET image_url=${quote(p.image_url)}, image_rights=${quote(p.image_rights)}, image_caption=${quote(p.caption)}, image_attribution=${quote(p.attribution)}, image_reference_urls=${merged} WHERE id=${quote(p.id)} AND name_ko=${quote(p.name_ko)} AND category_id='food';`,
    );
  }
  return updates.join('\n');
}

async function main() {
  const manifest = JSON.parse(
    await readFile(resolve(root, 'data/food-menu-photos-2026-11.json'), 'utf8'),
  );
  const activities = (
    await Promise.all(
      ['activities-70.json', 'extra-food-2026-11.json'].map(async (name) =>
        JSON.parse(await readFile(resolve(root, 'data', name), 'utf8')),
      ),
    )
  ).flat();
  const sql = await buildFoodMenuPhotoSql(manifest, activities);
  if (
    process.argv[2] === '--sql' &&
    process.argv[3] &&
    process.argv.length === 4
  ) {
    const path = resolve(process.argv[3]);
    await writeFile(path, sql + '\n');
    console.log(
      `Validated fifteen local menu photographs; photo-only SQL written to ${path}. No database changed.`,
    );
  } else {
    assert.ok(
      process.argv.length === 2 ||
        (process.argv.length === 3 && process.argv[2] === '--check'),
      'Usage: node scripts/import-food-menu-photos.mjs [--check | --sql path]',
    );
    console.log(
      `Menu photos valid: ${manifest.photos.length} local WebP dish images. No database changed.`,
    );
  }
}

if (
  process.argv[1] &&
  import.meta.url === pathToFileURL(resolve(process.argv[1])).href
)
  await main();
