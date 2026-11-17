import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

const { lights } = JSON.parse(
  await readFile(
    new URL('../public/trip/korea-lights.json', import.meta.url),
    'utf8',
  ),
);
const { countries } = JSON.parse(
  await readFile(
    new URL('../public/trip/korea-10m.json', import.meta.url),
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
const land = (x, y) =>
  countries['South Korea'].some(
    (p) => inside(x, y, p[0]) && !p.slice(1).some((r) => inside(x, y, r)),
  );

await test('the quieter national field keeps randomized sizes and the city hubs', () => {
  assert.equal(
    lights.length,
    12492,
    'Preserve5,760city lights while retaining55%of the12,240dispersed points.',
  );
  for (const dispersed of [true, false]) {
    const values = lights
      .filter((point) => (point.group === 'land-coverage') === dispersed)
      .map((point) => point.size)
      .sort((a, b) => a - b);
    assert(
      values[0] >= 0.5 && values.at(-1) <= 1.5,
      'Bound large sprites so stars stay crisp during zoom.',
    );
    assert(
      values[Math.floor(values.length * 0.9)] -
        values[Math.floor(values.length * 0.1)] >=
        0.6,
      'Each layer needs a visible mix of small and large points.',
    );
    assert(
      values.filter((size) => size <= 0.9).length / values.length > 0.55,
      'Most stars should stay small.',
    );
  }
  const anchors = lights.filter((point) => point.anchor);
  assert.equal(
    new Set(anchors.map((point) => point.size)).size,
    anchors.length,
    'Anchor stars must also receive random sizes.',
  );
});

await test('every light layer has visibly different individual brightness levels', () => {
  for (const dispersed of [true, false]) {
    const values = lights
      .filter((point) => (point.group === 'land-coverage') === dispersed)
      .map((point) => point.brightness)
      .sort((a, b) => a - b);
    assert(
      values[Math.floor(values.length * 0.9)] -
        values[Math.floor(values.length * 0.1)] >=
        0.4,
      'Dim and bright lights must coexist within each layer.',
    );
  }
  const anchors = lights.filter((point) => point.anchor);
  assert.equal(
    new Set(anchors.map((point) => point.brightness)).size,
    anchors.length,
    'Anchor stars must also receive individual brightness.',
  );
});

await test('cities retain a modest emphasis over the dimmer dispersed field', () => {
  const dispersed = lights.filter((point) => point.group === 'land-coverage');
  const city = lights.filter((point) => point.group !== 'land-coverage');
  const mean = (points) =>
    points.reduce((sum, point) => sum + point.brightness, 0) / points.length;
  assert(
    city.length === 5760 && dispersed.length === 6732,
    'Keep the city hubs intact and reduce only the dispersed field.',
  );
  assert(
    mean(dispersed) >= 0.5 && mean(dispersed) <= 0.6,
    'Dispersed lights should remain visible at a lower brightness.',
  );
  assert(
    mean(city) > mean(dispersed) + 0.05,
    'City lights should stand out from the quieter dispersed layer.',
  );
});

await test('western and central inland areas receive lights between the city hubs', (t) => {
  const probes = [];
  for (let latitude = 34.5; latitude <= 38.1; latitude += 0.12) {
    for (let longitude = 126.1; longitude <= 128.1; longitude += 0.12) {
      if (
        ![-0.025, 0, 0.025].every((dx) =>
          [-0.025, 0, 0.025].every((dy) => land(longitude + dx, latitude + dy)),
        )
      )
        continue;
      const count = lights.filter(
        (p) =>
          ((p.longitude - longitude) * 0.8) ** 2 +
            (p.latitude - latitude) ** 2 <
          0.075 ** 2,
      ).length;
      probes.push({
        longitude: +longitude.toFixed(2),
        latitude: +latitude.toFixed(2),
        count,
      });
    }
  }
  assert(
    probes.length > 100,
    'Measure actual interior land across the country.',
  );
  const covered = probes.filter((p) => p.count >= 3).length / probes.length;
  t.diagnostic(
    `${(covered * 100).toFixed(1)}% coverage across ${probes.length} inland probes`,
  );
  assert(
    covered >= 0.9,
    `Only ${(covered * 100).toFixed(1)}% of inland probes have three lights within about 7 km; empty areas: ${JSON.stringify(probes.filter((p) => p.count < 6).slice(0, 8))}`,
  );
  assert.equal(
    lights.length,
    12492,
    'Keep some lights between cities while calming the dispersed field.',
  );
});
