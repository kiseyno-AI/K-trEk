import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { readFile, writeFile } from 'node:fs/promises';
import { resolve } from 'node:path';

assert(process.argv[2], 'Pass the pinned sgis-20261001.geojson file path.');
const raw = await readFile(resolve(process.argv[2]));
const sha256 = createHash('sha256').update(raw).digest('hex');
assert.equal(
  sha256,
  '843ece3a0b3429742cd4a1b699cc13987a88b5e5401f382e7fdaaa194ea5e605',
);
const source = JSON.parse(raw);
const key = (p) => `${p[0].toFixed(7)},${p[1].toFixed(7)}`;
const groups = (features, property) => {
  const result = new Map();
  for (const feature of features) {
    const id = feature.properties[property];
    if (!result.has(id)) result.set(id, []);
    result.get(id).push(feature);
  }
  return result;
};
function sharedBoundaries(features) {
  const pending = new Map(),
    provinces = [],
    cities = new Map();
  for (const { geometry, properties } of features) {
    const polygons =
      geometry.type === 'Polygon'
        ? [geometry.coordinates]
        : geometry.coordinates;
    for (const polygon of polygons)
      for (const ring of polygon)
        for (let i = 1; i < ring.length; i++) {
          const a = ring[i - 1],
            b = ring[i],
            ka = key(a),
            kb = key(b);
          if (ka === kb) continue;
          const id = ka < kb ? `${ka}|${kb}` : `${kb}|${ka}`;
          const previous = pending.get(id);
          if (!previous) pending.set(id, { edge: [a, b], properties });
          else {
            pending.delete(id);
            if (previous.properties.sido !== properties.sido)
              provinces.push(previous.edge);
            else if (
              properties.sido !== '11' &&
              previous.properties.sgg !== properties.sgg
            ) {
              if (!cities.has(properties.sido)) cities.set(properties.sido, []);
              cities.get(properties.sido).push(previous.edge);
            }
          }
        }
  }
  return { provinces, cities };
}
function stitch(edges) {
  const pending = new Set(edges.map((_, i) => i)),
    neighbors = new Map();
  edges.forEach((edge, id) =>
    edge.forEach((point) => {
      const k = key(point);
      if (!neighbors.has(k)) neighbors.set(k, []);
      neighbors.get(k).push(id);
    }),
  );
  const lines = [];
  const consume = (id, first) => {
    const line = [first];
    let nextId = id;
    while (nextId !== undefined) {
      pending.delete(nextId);
      const edge = edges[nextId],
        last = line.at(-1);
      const point = key(edge[0]) === key(last) ? edge[1] : edge[0];
      line.push(point);
      const choices = neighbors.get(key(point));
      nextId =
        choices.length === 2
          ? choices.find((candidate) => pending.has(candidate))
          : undefined;
    }
    lines.push(line);
  };
  for (const [k, ids] of neighbors)
    if (ids.length !== 2) {
      for (const id of ids)
        if (pending.has(id))
          consume(
            id,
            edges[id].find((point) => key(point) === k),
          );
    }
  while (pending.size) {
    const id = pending.values().next().value;
    consume(id, edges[id][0]);
  }
  return lines;
}
function simplify(line, tolerance) {
  if (line.length <= 2) return line;
  const a = line[0],
    b = line.at(-1),
    dx = b[0] - a[0],
    dy = b[1] - a[1],
    length = dx * dx + dy * dy;
  let maximum = tolerance * tolerance,
    index = -1;
  for (let i = 1; i < line.length - 1; i++) {
    const p = line[i];
    const t = length
      ? Math.max(
          0,
          Math.min(1, ((p[0] - a[0]) * dx + (p[1] - a[1]) * dy) / length),
        )
      : 0;
    const distance = (p[0] - a[0] - t * dx) ** 2 + (p[1] - a[1] - t * dy) ** 2;
    if (distance > maximum) {
      maximum = distance;
      index = i;
    }
  }
  return index < 0
    ? [a, b]
    : [
        ...simplify(line.slice(0, index + 1), tolerance).slice(0, -1),
        ...simplify(line.slice(index), tolerance),
      ];
}
const prepare = (edges, tolerance) =>
  stitch(edges).map((line) =>
    simplify(line, tolerance).map((p) => p.map((n) => +n.toFixed(6))),
  );
const shared = sharedBoundaries(source.features);
const provinces = prepare(shared.provinces, 0.0008);
const cityGroups = [];
let cityCount = 0;
for (const [code, features] of groups(source.features, 'sido')) {
  if (code === '11') continue; // Seoul keeps the existing, finer 25-gu geometry.
  const cityCodes = [...groups(features, 'sgg').keys()];
  const lines = prepare(shared.cities.get(code) ?? [], 0.0002);
  if (!lines.length) continue;
  const points = lines.flat();
  const bounds = points.reduce(
    (b, p) => [
      Math.min(b[0], p[0]),
      Math.min(b[1], p[1]),
      Math.max(b[2], p[0]),
      Math.max(b[3], p[1]),
    ],
    [Infinity, Infinity, -Infinity, -Infinity],
  );
  cityGroups.push({ provinceCode: code, bounds, cityCodes, lines });
  cityCount += cityCodes.length;
}
const artifact = {
  version: 1,
  epoch: '2026-10-01',
  sourceSha256: sha256,
  sourceUrl:
    'https://raw.githubusercontent.com/vuski/admdongkor/3bc00489b76696db864bdbea4b19985cdfa8b403/ver20261001/HangJeongDong_ver20261001.geojson',
  attribution: {
    label: 'SGIS · vuski/admdongkor',
    license: 'CC-BY-4.0',
    licenseUrl: 'https://creativecommons.org/licenses/by/4.0/',
    sourceLicense:
      'https://raw.githubusercontent.com/vuski/admdongkor/3bc00489b76696db864bdbea4b19985cdfa8b403/LICENSE-DATA',
    modifications:
      'Shared province and city/gu edges extracted; coastlines omitted because the existing country outline already draws them. Chains simplified for display and rounded to six decimals. Seoul gu use the separate finer existing extract.',
  },
  provinceCount: groups(source.features, 'sido').size,
  cityCount,
  provinces,
  cityGroups,
};
const output = new URL('../public/trip/korea-regions.json', import.meta.url);
await writeFile(output, JSON.stringify(artifact));
console.log(
  JSON.stringify({
    provinces: artifact.provinceCount,
    cities: cityCount,
    bytes: (await readFile(output)).length,
  }),
);
