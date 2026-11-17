import assert from 'node:assert/strict';
import { readFile, writeFile } from 'node:fs/promises';

const root = new URL('../public/trip/', import.meta.url);
const geography = JSON.parse(
  await readFile(new URL('seoul-geography.json', root), 'utf8'),
);
const insideRing = (longitude, latitude, ring) => {
  let inside = false;
  for (let i = 0, j = ring.length - 1; i < ring.length; j = i++) {
    const [xi, yi] = ring[i],
      [xj, yj] = ring[j];
    if (
      yi > latitude !== yj > latitude &&
      longitude < ((xj - xi) * (latitude - yi)) / (yj - yi) + xi
    )
      inside = !inside;
  }
  return inside;
};
const parity = (longitude, latitude, rings) =>
  rings.reduce(
    (inside, ring) => inside !== insideRing(longitude, latitude, ring),
    false,
  );
const land = (longitude, latitude) =>
  parity(longitude, latitude, geography.boundary) &&
  !parity(longitude, latitude, [...geography.river, ...geography.riverHoles]);
const hub = (name, weight, sigmaX, sigmaY) => ({
  ...geography.labels.find((label) => label.name === name),
  weight,
  sigmaX,
  sigmaY,
});
const hubs = [
  hub('Gangnam', 2.1, 0.026, 0.02),
  hub('Jongno', 2.1, 0.027, 0.02),
  hub('Hongdae', 1.0, 0.025, 0.018),
  hub('Yeouido', 0.9, 0.018, 0.013),
  hub('Jamsil', 1.1, 0.023, 0.02),
  hub('Seongsu', 0.9, 0.022, 0.017),
  hub('Seoul Station', 0.8, 0.022, 0.018),
  // Additional broad urban footprints are illustrative, not surveyed light data.
  {
    name: 'Guro',
    longitude: 126.883,
    latitude: 37.493,
    weight: 0.9,
    sigmaX: 0.03,
    sigmaY: 0.022,
  },
  {
    name: 'Gangseo',
    longitude: 126.842,
    latitude: 37.56,
    weight: 0.8,
    sigmaX: 0.027,
    sigmaY: 0.027,
  },
  {
    name: 'Nowon',
    longitude: 127.064,
    latitude: 37.654,
    weight: 0.7,
    sigmaX: 0.024,
    sigmaY: 0.03,
  },
  {
    name: 'Eunpyeong',
    longitude: 126.927,
    latitude: 37.62,
    weight: 0.65,
    sigmaX: 0.027,
    sigmaY: 0.025,
  },
  {
    name: 'Gangdong',
    longitude: 127.14,
    latitude: 37.549,
    weight: 0.65,
    sigmaX: 0.026,
    sigmaY: 0.025,
  },
  {
    name: 'Jungnang',
    longitude: 127.084,
    latitude: 37.596,
    weight: 0.65,
    sigmaX: 0.026,
    sigmaY: 0.03,
  },
  {
    name: 'Gwanak',
    longitude: 126.947,
    latitude: 37.481,
    weight: 0.7,
    sigmaX: 0.03,
    sigmaY: 0.024,
  },
  {
    name: 'Dongjak',
    longitude: 126.943,
    latitude: 37.505,
    weight: 0.6,
    sigmaX: 0.027,
    sigmaY: 0.022,
  },
];
const gaussian = (longitude, latitude, center) =>
  Math.exp(
    -0.5 *
      (((longitude - center.longitude) / center.sigmaX) ** 2 +
        ((latitude - center.latitude) / center.sigmaY) ** 2),
  );
const mountains = [
  {
    longitude: 126.984,
    latitude: 37.647,
    sigmaX: 0.036,
    sigmaY: 0.034,
    weight: 0.94,
  },
  {
    longitude: 126.966,
    latitude: 37.435,
    sigmaX: 0.039,
    sigmaY: 0.028,
    weight: 0.94,
  },
  {
    longitude: 126.991,
    latitude: 37.55,
    sigmaX: 0.013,
    sigmaY: 0.009,
    weight: 0.7,
  },
];
let state = 0x20261116;
const random = () => {
  state = (state + 0x6d2b79f5) >>> 0;
  let value = state;
  value = Math.imul(value ^ (value >>> 15), value | 1);
  value ^= value + Math.imul(value ^ (value >>> 7), value | 61);
  return (((value ^ (value >>> 14)) >>> 0) + 0.5) / 4294967296;
};
const lights = [],
  cells = new Map();
const minimumGap = 0.00035;
const cellFor = (longitude, latitude) => [
  Math.floor((longitude * 0.79) / minimumGap),
  Math.floor(latitude / minimumGap),
];
const separated = (longitude, latitude) => {
  const [x, y] = cellFor(longitude, latitude);
  for (let dx = -1; dx <= 1; dx += 1)
    for (let dy = -1; dy <= 1; dy += 1)
      for (const point of cells.get(`${x + dx},${y + dy}`) ?? [])
        if (
          ((longitude - point.longitude) * 0.79) ** 2 +
            (latitude - point.latitude) ** 2 <
          minimumGap ** 2
        )
          return false;
  return true;
};
const [west, south, east, north] = geography.bounds;
let attempts = 0;
while (lights.length < 12000 && attempts++ < 500000) {
  const longitude = +(west + random() * (east - west)).toFixed(6);
  const latitude = +(south + random() * (north - south)).toFixed(6);
  if (!land(longitude, latitude)) continue;
  const urban = hubs.reduce(
    (sum, center) =>
      sum + center.weight * gaussian(longitude, latitude, center),
    0,
  );
  const terrain = mountains.reduce(
    (mask, center) =>
      mask * (1 - center.weight * gaussian(longitude, latitude, center)),
    1,
  );
  if (
    random() * 6 > (0.33 + urban) * terrain ||
    !separated(longitude, latitude)
  )
    continue;
  const emphasis = Math.min(1, urban / 2.5);
  const point = {
    longitude,
    latitude,
    brightness: +(0.18 + 0.68 * random() ** 1.15 + 0.09 * emphasis).toFixed(3),
    size: +(0.45 + 0.9 * random() ** 1.65).toFixed(3),
  };
  lights.push(point);
  const key = cellFor(longitude, latitude).join(',');
  if (!cells.has(key)) cells.set(key, []);
  cells.get(key).push(point);
}
assert.equal(
  lights.length,
  12000,
  'Sampling must produce the complete local field',
);
const around = (longitude, latitude, radius) =>
  lights.filter(
    (point) =>
      ((point.longitude - longitude) * 0.79) ** 2 +
        (point.latitude - latitude) ** 2 <
      radius ** 2,
  );
const hubDiagnostics = Object.fromEntries(
  hubs.map(({ name, longitude, latitude }) => {
    const points = around(longitude, latitude, 0.012);
    return [
      name,
      {
        count: points.length,
        meanBrightness: +(
          points.reduce((sum, point) => sum + point.brightness, 0) /
          points.length
        ).toFixed(3),
      },
    ];
  }),
);
await writeFile(
  new URL('seoul-lights.json', root),
  JSON.stringify(
    {
      version: 1,
      source:
        'Decorative Seoul night lights synthesized locally inside the prepared city boundary, excluding Han River water and retaining actual island cutouts. The field emphasizes Gangnam and Jongno with broad softer urban footprints and approximate mountain suppression; it is not measured luminosity, population, buildings or terrain.',
      attribution: geography.attribution,
      sampling: {
        seed: '0x20261116',
        count: 12000,
        method:
          'Continuous seeded random rejection sampling; smooth overlapping urban weights; 39 m approximate minimum separation; no lattice positions or coast snapping.',
        brightness:
          'Independent random 0.18–0.95 multipliers with a modest urban brightness lift.',
        size: 'Independent random 0.45–1.35 multipliers, biased toward small crisp points.',
        hubs,
        approximateMountainMasks: mountains,
      },
      diagnostics: { attempts, radiusDegrees: 0.012, hubs: hubDiagnostics },
      lights,
    },
    null,
    2,
  ) + '\n',
);
console.log(
  JSON.stringify({ count: lights.length, attempts, hubs: hubDiagnostics }),
);
