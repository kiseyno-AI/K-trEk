import assert from 'node:assert/strict';
import test from 'node:test';
import { readFile } from 'node:fs/promises';

void test('regional outlines are a bounded pinned nationwide extract with provincial and city-level geometry', async () => {
  const file = await readFile(
    new URL('../public/trip/korea-regions.json', import.meta.url),
  );
  const data = JSON.parse(file);
  assert.ok(file.byteLength < 800000);
  assert.equal(
    data.sourceSha256,
    '843ece3a0b3429742cd4a1b699cc13987a88b5e5401f382e7fdaaa194ea5e605',
  );
  assert.equal(data.epoch, '2026-10-01');
  assert.equal(data.provinceCount, 16);
  assert.equal(data.cityCount, 230);
  assert.equal(data.attribution.license, 'CC-BY-4.0');
  for (const code of ['26', '28', '41', '43', '44', '48', '50', '51', '52'])
    assert.ok(data.cityGroups.some((group) => group.provinceCode === code));
  assert.ok(data.cityGroups.every((group) => group.provinceCode !== '11'));
  assert.equal(
    data.cityGroups.reduce((sum, group) => sum + group.cityCodes.length, 0),
    230,
  );
  let vertices = 0;
  for (const line of [
    ...data.provinces,
    ...data.cityGroups.flatMap((group) => group.lines),
  ]) {
    assert.ok(line.length >= 2);
    vertices += line.length;
    for (const point of line) {
      assert.equal(point.length, 2);
      assert.ok(point.every(Number.isFinite));
      assert.ok(
        point[0] > 124 && point[0] < 132 && point[1] > 33 && point[1] < 39,
      );
    }
  }
  assert.ok(vertices > 20000 && vertices < 40000);
  for (const group of data.cityGroups) {
    const [west, south, east, north] = group.bounds;
    for (const [longitude, latitude] of group.lines.flat())
      assert.ok(
        longitude >= west &&
          longitude <= east &&
          latitude >= south &&
          latitude <= north,
      );
  }
});
