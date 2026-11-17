import assert from 'node:assert/strict';
import { readFile, writeFile } from 'node:fs/promises';
import { resolve } from 'node:path';

// Offline inputs and their pinned download sources are documented in SEOUL_GEOGRAPHY.md.
assert(
  process.argv[2],
  'Pass the directory containing the three cached source JSON files.',
);
const sourceDirectory = resolve(process.argv[2]);
const load = async (name) =>
  JSON.parse(await readFile(resolve(sourceDirectory, name), 'utf8'));
const [administrative, water, stations] = await Promise.all([
  load('sgis-20261001.geojson'),
  load('han-overpass.json'),
  load('anchors-overpass.json'),
]);
const bounds = [126.76, 37.4, 127.2, 37.72];
const key = (point) => point.map((value) => value.toFixed(7)).join(',');
const equal = (a, b) => key(a) === key(b);
const round = (point) => point.map((value) => Number(value.toFixed(6)));
const area = (ring) =>
  Math.abs(
    ring
      .slice(1)
      .reduce(
        (sum, point, i) => sum + ring[i][0] * point[1] - point[0] * ring[i][1],
        0,
      ) / 2,
  );

function joinRings(raw) {
  const pending = raw.map((line) => [...line]);
  const rings = [];
  while (pending.length) {
    const ring = pending.pop();
    while (!equal(ring[0], ring.at(-1))) {
      const index = pending.findIndex(
        (line) =>
          equal(line[0], ring.at(-1)) || equal(line.at(-1), ring.at(-1)),
      );
      assert(index >= 0, 'Source polygon ways must join into complete rings.');
      const line = pending.splice(index, 1)[0];
      if (!equal(line[0], ring.at(-1))) line.reverse();
      ring.push(...line.slice(1));
    }
    rings.push(ring);
  }
  return rings;
}

function dissolve(features) {
  const edges = new Map();
  for (const { geometry } of features) {
    const polygons =
      geometry.type === 'Polygon'
        ? [geometry.coordinates]
        : geometry.coordinates;
    for (const polygon of polygons)
      for (const ring of polygon) {
        for (let i = 1; i < ring.length; i += 1) {
          const edge = [ring[i - 1], ring[i]];
          if (equal(...edge)) continue;
          const edgeKey = edge
            .map(key)
            .sort((a, b) => a.localeCompare(b))
            .join('|');
          if (edges.has(edgeKey)) edges.delete(edgeKey);
          else edges.set(edgeKey, edge);
        }
      }
  }
  return joinRings([...edges.values()]);
}

function simplify(line, tolerance = 0.00006) {
  if (line.length <= 2) return line;
  const a = line[0],
    b = line.at(-1);
  const dx = b[0] - a[0],
    dy = b[1] - a[1],
    length = dx * dx + dy * dy;
  let maximum = tolerance * tolerance,
    index = -1;
  for (let i = 1; i < line.length - 1; i += 1) {
    const point = line[i];
    const t = length
      ? Math.max(
          0,
          Math.min(
            1,
            ((point[0] - a[0]) * dx + (point[1] - a[1]) * dy) / length,
          ),
        )
      : 0;
    const distance =
      (point[0] - a[0] - t * dx) ** 2 + (point[1] - a[1] - t * dy) ** 2;
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

function clipRing(ring) {
  let points = ring.slice(0, -1);
  for (const [axis, limit, direction] of [
    [0, bounds[0], 1],
    [0, bounds[2], -1],
    [1, bounds[1], 1],
    [1, bounds[3], -1],
  ]) {
    const output = [];
    for (let i = 0; i < points.length; i += 1) {
      const a = points[i],
        b = points[(i + 1) % points.length];
      const insideA = direction * (a[axis] - limit) >= 0,
        insideB = direction * (b[axis] - limit) >= 0;
      if (insideA) output.push(a);
      if (insideA !== insideB) {
        const t = (limit - a[axis]) / (b[axis] - a[axis]);
        output.push([a[0] + t * (b[0] - a[0]), a[1] + t * (b[1] - a[1])]);
      }
    }
    points = output;
  }
  return points.length ? [...points, points[0]] : [];
}

function prepareRing(ring, tolerance = 0.00006) {
  const clipped = clipRing(ring);
  if (clipped.length < 4 || area(clipped) < 1e-10) return null;
  let result = simplify(clipped, tolerance).map(round);
  if (result.length < 4) result = clipped.map(round);
  return result.filter(
    (point, index) => index === 0 || !equal(point, result[index - 1]),
  );
}

function clipLine(line) {
  const output = [];
  let current = [];
  for (let i = 1; i < line.length; i += 1) {
    const a = line[i - 1],
      b = line[i],
      delta = [b[0] - a[0], b[1] - a[1]];
    let start = 0,
      end = 1;
    for (let axis = 0; axis < 2; axis += 1) {
      if (delta[axis] === 0) {
        if (a[axis] < bounds[axis] || a[axis] > bounds[axis + 2]) end = -1;
      } else {
        const first = (bounds[axis] - a[axis]) / delta[axis],
          last = (bounds[axis + 2] - a[axis]) / delta[axis];
        start = Math.max(start, Math.min(first, last));
        end = Math.min(end, Math.max(first, last));
      }
    }
    if (start <= end) {
      const first = a.map((value, axis) => value + start * delta[axis]);
      const last = a.map((value, axis) => value + end * delta[axis]);
      if (current.length && !equal(current.at(-1), first)) {
        output.push(current);
        current = [];
      }
      if (!current.length) current.push(first);
      current.push(last);
    } else if (current.length) {
      output.push(current);
      current = [];
    }
  }
  if (current.length) output.push(current);
  return output.map((points) => simplify(points).map(round));
}

const districtNames = {
  11110: 'Jongno',
  11140: 'Jung',
  11170: 'Yongsan',
  11200: 'Seongdong',
  11215: 'Gwangjin',
  11230: 'Dongdaemun',
  11260: 'Jungnang',
  11290: 'Seongbuk',
  11305: 'Gangbuk',
  11320: 'Dobong',
  11350: 'Nowon',
  11380: 'Eunpyeong',
  11410: 'Seodaemun',
  11440: 'Mapo',
  11470: 'Yangcheon',
  11500: 'Gangseo',
  11530: 'Guro',
  11545: 'Geumcheon',
  11560: 'Yeongdeungpo',
  11590: 'Dongjak',
  11620: 'Gwanak',
  11650: 'Seocho',
  11680: 'Gangnam',
  11710: 'Songpa',
  11740: 'Gangdong',
};
const seoul = administrative.features.filter(
  ({ properties }) => properties.sido === '11',
);
assert.equal(
  seoul.length,
  427,
  'Use the pinned 2026-10-01 Seoul administrative snapshot.',
);
const districts = Object.entries(districtNames).map(([code, name]) => ({
  name,
  lines: dissolve(seoul.filter(({ properties }) => properties.sgg === code))
    .map((ring) => prepareRing(ring))
    .filter(Boolean),
}));
const river = [],
  riverHoles = [];
for (const relation of water.elements.filter(
  ({ type }) => type === 'relation',
)) {
  for (const [role, destination] of [
    ['outer', river],
    ['inner', riverHoles],
  ]) {
    const lines = relation.members
      .filter((member) => member.role === role)
      .map(({ geometry }) => geometry.map(({ lon, lat }) => [lon, lat]));
    destination.push(
      ...joinRings(lines)
        .map((ring) => prepareRing(ring, 0.000035))
        .filter(Boolean),
    );
  }
}
const riverCenterlines = water.elements
  .filter(({ type }) => type === 'way')
  .flatMap(({ geometry }) =>
    clipLine(geometry.map(({ lon, lat }) => [lon, lat])),
  );
const anchorIds = [
  ['Jongno', 7207442616],
  ['Hongdae', 13055976391],
  ['Gangnam', 5927529147],
  ['Jamsil', 6033315017],
  ['Yeouido', 6039313670],
  ['Seongsu', 5935554450],
  ['Seoul Station', 5772099311],
];
const labels = anchorIds.map(([name, id]) => {
  const station = stations.elements.find((element) => element.id === id);
  assert(station, `Missing sourced station anchor ${name}.`);
  return { name, longitude: station.lon, latitude: station.lat };
});
const riverAnchor = water.elements
  .find(({ type, id }) => type === 'way' && id === 378066781)
  .geometry.reduce((closest, point) =>
    Math.abs(point.lon - 127) < Math.abs(closest.lon - 127) ? point : closest,
  );
labels.push({
  name: 'Han River',
  longitude: riverAnchor.lon,
  latitude: riverAnchor.lat,
});
const sourceUrl =
  'https://raw.githubusercontent.com/vuski/admdongkor/3bc00489b76696db864bdbea4b19985cdfa8b403/ver20261001/HangJeongDong_ver20261001.geojson';
const result = {
  version: 1,
  bounds,
  attribution: [
    {
      label: 'Statistics Korea SGIS; processed by vuski/admdongkor',
      url: 'https://github.com/vuski/admdongkor',
      license: 'CC BY 4.0; upstream SGIS KOGL Type 1 attribution retained',
      licenseUrl:
        'https://github.com/vuski/admdongkor/blob/3bc00489b76696db864bdbea4b19985cdfa8b403/LICENSE-DATA',
    },
    {
      label: '© OpenStreetMap contributors',
      url: 'https://www.openstreetmap.org/copyright',
      license: 'ODbL 1.0',
      licenseUrl: 'https://opendatacommons.org/licenses/odbl/1-0/',
    },
  ],
  sources: {
    boundaries: {
      url: sourceUrl,
      epoch: '2026-10-01',
      administrativeDongCount: 427,
    },
    river: {
      url: 'https://overpass-api.de/api/interpreter',
      osmBase: water.osm3s.timestamp_osm_base,
      objects: ['relation/152336', 'relation/3769500', 'way/378066781'],
    },
    labels: {
      url: 'https://overpass-api.de/api/interpreter',
      osmBase: stations.osm3s.timestamp_osm_base,
      objects: [...anchorIds.map(([, id]) => `node/${id}`), 'way/378066781'],
    },
  },
  boundary: dissolve(seoul)
    .map((ring) => prepareRing(ring))
    .filter(Boolean),
  districts,
  river,
  riverHoles,
  riverCenterlines,
  labels,
};
const serialized = JSON.stringify(result) + '\n';
assert(
  Buffer.byteLength(serialized) <= 150_000,
  'Keep the delivered asset below 150KB.',
);
assert(
  river.length + riverHoles.length < 60,
  'Keep river ring rendering bounded.',
);
await writeFile(
  new URL('../public/trip/seoul-geography.json', import.meta.url),
  serialized,
);
console.log(
  JSON.stringify({
    bytes: Buffer.byteLength(serialized),
    districts: districts.length,
    boundaryRings: result.boundary.length,
    riverRings: river.length,
    islandRings: riverHoles.length,
    vertices: [
      ...result.boundary,
      ...districts.flatMap(({ lines }) => lines),
      ...river,
      ...riverHoles,
      ...riverCenterlines,
    ].reduce((sum, ring) => sum + ring.length, 0),
  }),
);
