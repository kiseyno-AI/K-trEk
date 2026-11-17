import assert from 'node:assert/strict';
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { join, resolve } from 'node:path';
import { pathToFileURL } from 'node:url';
import { parseActivity } from '../lib/activities.ts';

const quote = (value) => `'${String(value).replaceAll("'", "''")}'`;
const precisions = ['venue', 'building', 'site', 'area_start'];

export function buildActivityCoordinateStatements(manifest, activities) {
  assert.equal(manifest.crs, 'EPSG:4326', 'Coordinates must use WGS84.');
  assert.equal(
    manifest.activities.length,
    70,
    'Exactly 70 coordinate records are required.',
  );
  assert.equal(
    new Set(manifest.activities.map((point) => point.id)).size,
    70,
    'Coordinate IDs must be unique.',
  );
  assert.equal(
    activities.length,
    70,
    'Exactly 70 activity records are required.',
  );
  const byId = new Map(activities.map((activity) => [activity.id, activity]));
  assert.equal(byId.size, 70, 'Activity IDs must be unique.');
  return manifest.activities.map((point) => {
    const activity = byId.get(point.id);
    assert.equal(
      point.name_ko,
      activity?.name_ko,
      `Identity mismatch: ${point.id}`,
    );
    assert.equal(point.coordinate_status, 'verified');
    assert.ok(
      precisions.includes(point.precision),
      `Unknown precision: ${point.id}`,
    );
    if (activity.location_type === 'area')
      assert.equal(
        point.precision,
        'area_start',
        `An explicit start/meeting reference is required: ${point.id}`,
      );
    assert.ok(
      point.pin_label && point.pin_description && point.matched_address,
      `Missing pin meaning: ${point.id}`,
    );
    assert.ok(
      !/[\uac00-\ud7a3\u3131-\u318e]/.test(
        point.pin_label + point.pin_description,
      ),
      'Public pin descriptions must be English.',
    );
    assert.match(point.checked_at, /^\d{4}-\d{2}-\d{2}$/);
    assert.equal(
      new Date(point.checked_at).toISOString().slice(0, 10),
      point.checked_at,
    );
    assert.ok(
      point.source_urls.length > 0,
      `Coordinate sources required: ${point.id}`,
    );
    for (const link of point.source_urls) {
      const url = new URL(link);
      assert.ok(
        url.protocol === 'https:' && !url.username && !url.password,
        'Coordinate sources must be public HTTPS URLs.',
      );
    }
    parseActivity({
      ...activity,
      latitude: point.latitude,
      longitude: point.longitude,
      coordinate_status: 'verified',
      source_urls: point.source_urls,
    });
    const marker = `Coordinate pin [${point.id}; WGS84; ${point.checked_at}]`;
    const pinDescription = `${point.pin_label} (${point.precision}): ${point.pin_description}`;
    const evidence = `${marker}: ${pinDescription} Source: ${point.source_urls[0]}.${point.source_kind === 'osm_feature' ? ' © OpenStreetMap contributors, ODbL.' : ''}`;
    const areaPin = `Map starting point: ${point.pin_label}. ${point.pin_description}`;
    const same = `latitude = ${point.latitude} AND longitude = ${point.longitude} AND coordinate_status = 'verified'`;
    const eligible = `((latitude IS NULL AND longitude IS NULL AND coordinate_status = 'unassigned') OR (${same}))`;
    const missingUrls = point.source_urls
      .map(
        (url) =>
          `NOT EXISTS (SELECT 1 FROM json_each(source_urls) WHERE value = ${quote(url)})`,
      )
      .join(' OR ');
    const additions = point.source_urls
      .map((url) => `SELECT ${quote(url)} AS value`)
      .join(' UNION ');
    return `UPDATE activities SET latitude = ${point.latitude}, longitude = ${point.longitude}, coordinate_status = 'verified', source_urls = (SELECT json_group_array(value) FROM (SELECT value FROM json_each(source_urls) UNION ${additions})), source_evidence = CASE WHEN instr(COALESCE(source_evidence, ''), ${quote(marker)}) > 0 THEN source_evidence ELSE COALESCE(source_evidence, '') || char(10) || ${quote(evidence)} END, area_description = CASE WHEN location_type = 'area' AND instr(COALESCE(area_description, ''), ${quote(areaPin)}) = 0 THEN COALESCE(area_description, '') || char(10) || ${quote(areaPin)} ELSE area_description END, updated_at = strftime('%Y-%m-%dT%H:%M:%fZ', 'now') WHERE id = ${quote(point.id)} AND name_ko = ${quote(point.name_ko)} AND ${eligible} AND (coordinate_status != 'verified' OR instr(COALESCE(source_evidence, ''), ${quote(marker)}) = 0 OR ${missingUrls} OR (location_type = 'area' AND instr(COALESCE(area_description, ''), ${quote(areaPin)}) = 0));`;
  });
}

export function coordinateSqlBatches(statements, maximumBytes = 50000) {
  const batches = [];
  let current = '';
  for (const statement of statements) {
    const sql = statement + '\n';
    assert.ok(
      Buffer.byteLength(sql) <= maximumBytes,
      'One coordinate statement exceeds the batch limit.',
    );
    if (current && Buffer.byteLength(current + sql) > maximumBytes) {
      batches.push(current);
      current = '';
    }
    current += sql;
  }
  if (current) batches.push(current);
  return batches;
}

if (
  process.argv[1] &&
  import.meta.url === pathToFileURL(resolve(process.argv[1])).href
) {
  const args = process.argv.slice(2);
  assert.ok(
    (args.length === 1 && ['--check', '--sql'].includes(args[0])) ||
      (args.length === 2 && args[0] === '--sql-dir'),
    'Usage: node --experimental-strip-types scripts/import-activity-coordinates.mjs --check|--sql|--sql-dir <directory>',
  );
  const manifest = JSON.parse(
    await readFile(
      new URL('../data/activity-coordinates.json', import.meta.url),
      'utf8',
    ),
  );
  const activities = JSON.parse(
    await readFile(
      new URL('../data/activities-70.json', import.meta.url),
      'utf8',
    ),
  );
  const statements = buildActivityCoordinateStatements(manifest, activities);
  const batches = coordinateSqlBatches(statements);
  if (args[0] === '--sql') process.stdout.write(statements.join('\n') + '\n');
  else if (args[0] === '--sql-dir') {
    await mkdir(args[1], { recursive: true });
    for (const [index, sql] of batches.entries())
      await writeFile(
        join(
          args[1],
          `activity-coordinates-${String(index + 1).padStart(3, '0')}.sql`,
        ),
        sql,
      );
    console.log(
      `Prepared ${batches.length} complete-statement batches, each at most 50,000 bytes. No database was changed.`,
    );
  } else
    console.log(
      `70 sourced WGS84 coordinate pins validated; ${batches.length} bounded SQL batches ready. No database was changed.`,
    );
}
