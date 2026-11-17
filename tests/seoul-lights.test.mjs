import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';

const assetURL = new URL('../public/trip/seoul-lights.json', import.meta.url);
const { lights } = JSON.parse(await readFile(assetURL, 'utf8'));
const geography = JSON.parse(
  await readFile(
    new URL('../public/trip/seoul-geography.json', import.meta.url),
    'utf8',
  ),
);

const inside = (x, y, ring) => {
  let result = false;
  for (let i = 0, j = ring.length - 1; i < ring.length; j = i++) {
    const [a, b] = ring[i],
      [c, d] = ring[j];
    if (b > y !== d > y && x < ((c - a) * (y - b)) / (d - b) + a)
      result = !result;
  }
  return result;
};
const ringCount = (point, rings) =>
  rings.filter((ring) => inside(point.longitude, point.latitude, ring)).length;
const around = (longitude, latitude) =>
  lights.filter(
    (point) =>
      ((point.longitude - longitude) * 0.79) ** 2 +
        (point.latitude - latitude) ** 2 <
      0.012 ** 2,
  );

await test('Seoul closeups receive a bounded offline field of 12,000 individual lights', async () => {
  const raw = await readFile(assetURL, 'utf8');
  const field = JSON.parse(raw);
  assert.equal(field.version, 1);
  assert.equal(field.lights.length, 12000);
  assert.ok(Buffer.byteLength(raw) < 2_000_000);
  const positions = new Set();
  for (const point of field.lights) {
    assert.ok(point.longitude >= 126.76 && point.longitude <= 127.2);
    assert.ok(point.latitude >= 37.4 && point.latitude <= 37.72);
    assert.ok(point.brightness >= 0.18 && point.brightness <= 0.95);
    assert.ok(point.size >= 0.45 && point.size <= 1.35);
    positions.add(`${point.longitude},${point.latitude}`);
  }
  assert.equal(positions.size, field.lights.length);
});

await test('local lights stay inside Seoul and off actual Han River water, while Yeouido remains lit', () => {
  for (const point of lights) {
    assert.equal(ringCount(point, geography.boundary) % 2, 1);
    assert.equal(
      ringCount(point, [...geography.river, ...geography.riverHoles]) % 2,
      0,
    );
  }
  const han = { longitude: 126.9990311, latitude: 37.5170669 };
  assert.equal(
    ringCount(han, [...geography.river, ...geography.riverHoles]) % 2,
    1,
  );
  assert.ok(
    around(126.9243018, 37.5216685).length > 100,
    'Mapped island land must not become a water-shaped gap.',
  );
});

await test('Gangnam and Jongno stand out while other Seoul neighborhoods remain populated', () => {
  const gangnam = around(127.0279845, 37.4980418);
  const jongno = around(126.9923242, 37.5704405);
  const outer = around(126.812, 37.548);
  assert.ok(gangnam.length >= 200 && jongno.length >= 200);
  assert.ok(
    gangnam.length > outer.length * 2 && jongno.length > outer.length * 2,
  );
  const average = (points) =>
    points.reduce((sum, point) => sum + point.brightness, 0) / points.length;
  assert.ok(average(gangnam) > average(outer));
  assert.ok(average(jongno) > average(outer));
  for (const [longitude, latitude] of [
    [126.9234474, 37.5566261],
    [127.1001365, 37.5132169],
    [127.0561016, 37.5445688],
    [126.883, 37.493],
    [126.842, 37.56],
    [127.064, 37.654],
    [127.084, 37.596],
  ])
    assert.ok(
      around(longitude, latitude).length >= 90,
      'Secondary residential and commercial areas need continuous lights.',
    );
  assert.ok(
    around(126.984, 37.647).length < 30,
    'Bukhansan should remain softly dark.',
  );
  assert.ok(
    around(126.966, 37.435).length < 30,
    'Gwanaksan should remain softly dark.',
  );
});

await test('individual stars vary in brightness and size without grid lines or tight bright clumps', () => {
  for (const field of ['brightness', 'size']) {
    const values = lights.map((point) => point[field]).sort((a, b) => a - b);
    assert.ok(values[10800] - values[1200] > 0.5);
  }
  const cells = new Map(),
    longitudePhases = Array(10).fill(0),
    latitudePhases = Array(10).fill(0);
  for (const point of lights) {
    const key = `${Math.floor(point.longitude / 0.005)},${Math.floor(point.latitude / 0.005)}`;
    cells.set(key, (cells.get(key) ?? 0) + 1);
    longitudePhases[Math.floor(((point.longitude * 1000) % 1) * 10)] += 1;
    latitudePhases[Math.floor(((point.latitude * 1000) % 1) * 10)] += 1;
  }
  assert.ok(
    Math.max(...cells.values()) < 30,
    'No small area should become a dense sprite pile.',
  );
  for (const count of [...longitudePhases, ...latitudePhases])
    assert.ok(
      count > 900 && count < 1500,
      'Coordinates should occupy the spaces between regular grid lines.',
    );
});
