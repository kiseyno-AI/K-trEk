import assert from 'node:assert/strict';
import { mkdtemp, readFile, rm, stat, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { spawnSync } from 'node:child_process';

const root = fileURLToPath(new URL('../', import.meta.url));
const quote = (value) => `'${String(value).replaceAll("'", "''")}'`;
const mergeUrls = (column, urls) =>
  `(SELECT json_group_array(value) FROM (SELECT value FROM json_each(${column}) UNION ${urls.map((url) => `SELECT ${quote(url)} AS value`).join(' UNION ')}))`;
const httpsUrl = (value, label) => {
  const url = new URL(value);
  assert.ok(
    url.protocol === 'https:' && !url.username && !url.password,
    `${label} must be a public HTTPS URL.`,
  );
  return url;
};

export async function buildActivityPhotoSql(
  manifest,
  activities,
  assetRoot = root,
) {
  const records = manifest.activities;
  const photoByKey = new Map(
    manifest.photos.map((photo) => [photo.key, photo]),
  );
  assert.equal(
    photoByKey.size,
    manifest.photos.length,
    'Photo keys must be unique.',
  );
  const activityById = new Map(
    activities.map((activity) => [activity.id, activity]),
  );
  assert.equal(
    records.length,
    70,
    'All 70 activities must have a photo assignment.',
  );
  assert.equal(
    new Set(records.map((record) => record.id)).size,
    70,
    'Photo assignments must be unique.',
  );
  for (const record of records) {
    const activity = activityById.get(record.id);
    assert.ok(activity, `Unknown activity ${record.id}`);
    assert.equal(
      record.name_ko,
      activity.name_ko,
      `Activity identity mismatch: ${record.id}`,
    );
    const photo = photoByKey.get(record.photo_key);
    assert.ok(photo, `Missing photo ${record.photo_key}`);
    assert.equal(record.image_url, photo.image_url);
    assert.ok(
      ['licensed', 'owned', 'official_reference'].includes(record.image_rights),
      `Unsupported image rights for ${record.id}`,
    );
    assert.ok(['venue', 'area_context'].includes(record.role));
    if (record.role === 'area_context')
      assert.match(record.caption, /^Area context — .+not a photo of /i);
    assert.ok(
      record.caption && record.attribution && photo.author && photo.license,
    );
    const source = httpsUrl(photo.sourcePage, 'Photo source');
    if (record.image_rights === 'official_reference') {
      assert.equal(
        record.role,
        'venue',
        'Official clinic references must show the actual venue.',
      );
      assert.notEqual(
        source.hostname,
        'commons.wikimedia.org',
        'Official references must use the official website source page.',
      );
      assert.equal(
        photo.licenseURL,
        photo.sourcePage,
        'An official reference links to its source page, not a claimed license.',
      );
      assert.match(
        photo.license,
        /reuse license unverified/i,
        'Official reference reuse rights must remain explicit.',
      );
      assert.match(
        record.attribution,
        /reuse license unverified/i,
        'Official reference attribution must disclose unverified reuse rights.',
      );
      if (!record.image_url.startsWith('/')) {
        httpsUrl(record.image_url, 'Official image reference');
        assert.ok(
          [photo.originalUrl, photo.downloadUrl].includes(record.image_url),
          'Official image reference must match the recorded original or final image URL.',
        );
      }
    } else {
      if (record.image_rights === 'licensed')
        assert.match(
          photo.sourcePage,
          /^https:\/\/commons\.wikimedia\.org\/wiki\/File:/,
        );
      assert.doesNotMatch(
        photo.license,
        /reuse license unverified/i,
        'Unverified reference rights cannot be registered as licensed or owned.',
      );
      assert.ok(
        ['http:', 'https:'].includes(new URL(photo.licenseURL).protocol),
      );
    }
    if (
      record.image_rights !== 'official_reference' ||
      record.image_url.startsWith('/')
    ) {
      assert.match(record.image_url, /^\/trip\/photos\/[a-z0-9-]+\.webp$/);
      const file = await stat(
        resolve(assetRoot, 'public', record.image_url.slice(1)),
      );
      assert.ok(file.size > 1000, `Empty photo asset: ${record.image_url}`);
    }
  }
  assert.ok(
    activities.every((activity) =>
      records.some((record) => record.id === activity.id),
    ),
    'The imported activity set must be fully covered.',
  );

  const sql = [
    'PRAGMA foreign_keys = ON;',
    ...records.map((record) => {
      const photo = photoByKey.get(record.photo_key);
      const rights =
        record.image_rights === 'official_reference'
          ? 'Official website reference · reuse license unverified'
          : record.image_rights;
      const evidence = `Photo (${record.role}): ${record.caption} | ${record.attribution} | ${photo.sourcePage} | Rights: ${rights} | ${record.image_rights === 'official_reference' ? 'Source reference' : 'License'}: ${photo.licenseURL} | ${photo.changes}`;
      return `UPDATE activities SET image_url = ${quote(record.image_url)}, image_rights = ${quote(record.image_rights)}, image_caption = ${quote(record.caption)}, image_attribution = ${quote(record.attribution)}, image_reference_urls = ${mergeUrls('image_reference_urls', [photo.sourcePage, photo.licenseURL])}, source_evidence = CASE WHEN instr(COALESCE(source_evidence, ''), ${quote(photo.sourcePage)}) > 0 THEN source_evidence ELSE COALESCE(source_evidence, '') || char(10) || ${quote(evidence)} END WHERE id = ${quote(record.id)} AND name_ko = ${quote(record.name_ko)};`;
    }),
  ].join('\n');
  return sql;
}

async function main() {
  const manifest = JSON.parse(
    await readFile(resolve(root, 'data/activity-photos.json'), 'utf8'),
  );
  const data = JSON.parse(
    await readFile(resolve(root, 'data/activities-70.json'), 'utf8'),
  );
  const activities = Array.isArray(data) ? data : data.activities;
  const records = manifest.activities;
  const sql = await buildActivityPhotoSql(manifest, activities);
  const expectedRows = records
    .map(
      (record) =>
        `(id = ${quote(record.id)} AND name_ko = ${quote(record.name_ko)})`,
    )
    .join(' OR ');

  if (process.argv.includes('--check')) {
    console.log(
      `Photo manifest valid: ${records.length} activities, ${manifest.photos.length} photo sources; ${records.filter((record) => record.role === 'venue').length} venue / ${records.filter((record) => record.role === 'area_context').length} context / ${records.filter((record) => record.image_rights === 'official_reference').length} official-reference assignments.`,
    );
  } else if (process.argv.includes('--sql')) {
    process.stdout.write(sql + '\n');
  } else {
    assert.equal(
      process.argv.length,
      2,
      'Usage: node scripts/import-activity-photos.mjs [--check|--sql]',
    );
    const wrangler = [
      resolve(root, 'node_modules/wrangler/bin/wrangler.js'),
      'd1',
      'execute',
      'DB',
      '--local',
      '--config',
      resolve(root, 'db/wrangler.local.jsonc'),
      '--persist-to',
      resolve(root, '.wrangler/state'),
    ];
    const environment = {
      ...process.env,
      WRANGLER_WRITE_LOGS: 'false',
      MINIFLARE_REGISTRY_PATH: resolve(root, '.wrangler/registry'),
    };
    const inspection = spawnSync(
      process.execPath,
      [
        ...wrangler,
        '--command',
        `SELECT COUNT(*) AS matched FROM activities WHERE ${expectedRows};`,
        '--json',
      ],
      { cwd: root, encoding: 'utf8', env: environment },
    );
    assert.equal(
      inspection.status,
      0,
      `Cannot inspect local activities: ${inspection.stderr}`,
    );
    assert.equal(
      JSON.parse(inspection.stdout)[0]?.results?.[0]?.matched,
      70,
      'Import the matching 70 activities before registering photos.',
    );
    const temporary = await mkdtemp(join(tmpdir(), 'korea-activity-photos-'));
    try {
      const file = join(temporary, 'photos.sql');
      await writeFile(file, sql);
      const result = spawnSync(
        process.execPath,
        [...wrangler, '--file', file],
        { cwd: root, stdio: 'inherit', env: environment },
      );
      assert.equal(
        result.status,
        0,
        'Local photo import failed. Import the 70 activities and caption migration first.',
      );
      console.log(
        `Registered photo assignments with their explicit rights status for ${records.length} activities in local D1.`,
      );
    } finally {
      await rm(temporary, { recursive: true, force: true });
    }
  }
}

if (
  process.argv[1] &&
  import.meta.url === pathToFileURL(resolve(process.argv[1])).href
)
  await main();
