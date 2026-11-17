import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';

const raw = await readFile(
  new URL('../public/trip/seoul-geography.json', import.meta.url),
  'utf8',
);
const geography = JSON.parse(raw);
const rings = [
  ...geography.boundary,
  ...geography.districts.flatMap((district) => district.lines),
  ...geography.river,
  ...geography.riverHoles,
];

await test('Seoul geography is a bounded offline WGS84 asset with all 25 districts', () => {
  assert.equal(geography.version, 1);
  assert.deepEqual(geography.bounds, [126.76, 37.4, 127.2, 37.72]);
  assert.ok(Buffer.byteLength(raw) <= 150_000);
  assert.equal(geography.districts.length, 25);
  assert.equal(
    new Set(geography.districts.map((district) => district.name)).size,
    25,
  );
  for (const line of [...rings, ...geography.riverCenterlines]) {
    for (const [longitude, latitude] of line) {
      assert.ok(Number.isFinite(longitude) && Number.isFinite(latitude));
      assert.ok(longitude >= 126.76 && longitude <= 127.2);
      assert.ok(latitude >= 37.4 && latitude <= 37.72);
    }
  }
  assert.ok(rings.reduce((count, ring) => count + ring.length, 0) < 7000);
  for (const ring of rings) {
    assert.ok(ring.length >= 4);
    assert.deepEqual(ring[0], ring.at(-1));
  }
});

await test('real Han River vectors cross Seoul and retain island cutouts', () => {
  assert.ok(geography.river.length > 0);
  assert.ok(geography.riverHoles.length > 0);
  assert.ok(geography.river.length + geography.riverHoles.length < 60);
  const centerline = geography.riverCenterlines.flat();
  assert.ok(Math.min(...centerline.map(([longitude]) => longitude)) <= 126.77);
  assert.ok(Math.max(...centerline.map(([longitude]) => longitude)) >= 127.19);
  const central = centerline.filter(
    ([longitude]) => longitude > 126.95 && longitude < 127.03,
  );
  assert.ok(central.length >= 3);
  assert.ok(
    central.every(([, latitude]) => latitude > 37.5 && latitude < 37.55),
  );
});

await test('major English anchors use the ground-level Seoul terminal and cover north and south of Han', () => {
  assert.deepEqual(
    geography.labels
      .map((label) => label.name)
      .sort((a, b) => a.localeCompare(b)),
    [
      'Gangnam',
      'Han River',
      'Hongdae',
      'Jamsil',
      'Jongno',
      'Seongsu',
      'Seoul Station',
      'Yeouido',
    ],
  );
  const terminal = geography.labels.find(
    (label) => label.name === 'Seoul Station',
  );
  assert.ok(Math.abs(terminal.longitude - 126.9707793) < 0.00001);
  assert.ok(Math.abs(terminal.latitude - 37.5545547) < 0.00001);
  assert.ok(
    geography.labels.find((label) => label.name === 'Jongno').latitude > 37.56,
  );
  assert.ok(
    geography.labels.find((label) => label.name === 'Gangnam').latitude < 37.51,
  );
});

await test('cached geometry retains pinned boundary and OSM provenance and licenses', () => {
  assert.ok(
    geography.attribution.some(
      ({ label, license }) => /SGIS/.test(label) && /CC BY 4.0/.test(license),
    ),
  );
  assert.ok(
    geography.attribution.some(
      ({ label, license }) =>
        /OpenStreetMap/.test(label) && /ODbL/.test(license),
    ),
  );
  assert.ok(
    geography.sources.boundaries.url.includes(
      '3bc00489b76696db864bdbea4b19985cdfa8b403',
    ),
  );
  assert.deepEqual(geography.sources.river.objects, [
    'relation/152336',
    'relation/3769500',
    'way/378066781',
  ]);
  for (const attribution of geography.attribution)
    assert.ok(attribution.url.startsWith('https://'));
});

const inside = (point, ring) => {
  let result = false;
  for (let i = 1; i < ring.length; i += 1) {
    const a = ring[i - 1],
      b = ring[i];
    if (
      a[1] > point[1] !== b[1] > point[1] &&
      point[0] < ((b[0] - a[0]) * (point[1] - a[1])) / (b[1] - a[1]) + a[0]
    )
      result = !result;
  }
  return result;
};

await test('Han River label sits on the real central waterway and holes remain inside water boundaries', () => {
  const label = geography.labels.find(({ name }) => name === 'Han River');
  assert.equal(label.longitude, 126.9990311);
  assert.equal(label.latitude, 37.5170669);
  const coordinate = [label.longitude, label.latitude];
  assert.ok(geography.river.some((ring) => inside(coordinate, ring)));
  assert.ok(!geography.riverHoles.some((ring) => inside(coordinate, ring)));
  for (const hole of geography.riverHoles)
    assert.ok(geography.river.some((ring) => inside(hole[0], ring)));
});

await test('simplified rings have no proper self intersections before stencil filling', () => {
  const side = (a, b, point) =>
    (b[0] - a[0]) * (point[1] - a[1]) - (b[1] - a[1]) * (point[0] - a[0]);
  for (const ring of rings) {
    for (let first = 1; first < ring.length; first += 1) {
      for (let second = first + 2; second < ring.length; second += 1) {
        if (first === 1 && second === ring.length - 1) continue;
        const a = ring[first - 1],
          b = ring[first],
          c = ring[second - 1],
          d = ring[second];
        assert.ok(
          !(
            side(a, b, c) * side(a, b, d) < -1e-20 &&
            side(c, d, a) * side(c, d, b) < -1e-20
          ),
        );
      }
    }
  }
});
