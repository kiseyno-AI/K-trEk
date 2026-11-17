import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

const page = await readFile(
  new URL('../app/activity-explorer.tsx', import.meta.url),
  'utf8',
);
const css = await readFile(
  new URL('../app/globals.css', import.meta.url),
  'utf8',
);
const planet = await readFile(
  new URL('../app/planet-canvas.tsx', import.meta.url),
  'utf8',
);
const source = `${page}\n${planet}`;
const lightMap = JSON.parse(
  await readFile(
    new URL('../public/trip/korea-lights.json', import.meta.url),
    'utf8',
  ),
);
const lights = lightMap.lights;

for (const expected of [
  'K-trEk,',
  'brand-out',
  'favoriteIds',
  'draftVoteIds',
  'Submit vote',
  'From {origin.name}',
  'visibilitychange',
  'What makes you excited?',
  'Focused activity:',
  'mapFocus',
  'detailZoom',
  'PlanetCanvas',
  'carouselWheelGesture',
]) {
  assert.match(
    source,
    new RegExp(expected.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')),
  );
}

assert.match(css, /prefers-reduced-motion/);
assert.match(css, /activity-card/);
assert.match(planet, /continuous-earth/);
assert.match(planet, /if \(progress < 1\)/);
assert.match(planet, /deleteTexture/);
assert.match(planet, /prefers-reduced-motion/);
assert.doesNotMatch(source, /RegionalMapCanvas|cityBlend|fullResolution/);
const svgClusters = [
  [43, 28, 10],
  [47, 31, 5],
  [54, 44, 6],
  [61, 54, 5],
  [67, 58, 8],
  [77, 69, 12],
  [50, 66, 6],
  [39, 86, 7],
  [70, 38, 4],
  [32, 42, 4],
];
assert.deepEqual(
  lightMap.sourceSVG.clusters,
  svgClusters,
  'Preserve original SVG locations and halo radii',
);
assert.equal(
  lights.length,
  12492,
  'Preserve the city field while calming dispersed coverage',
);
assert.deepEqual(
  lightMap.clusters.map((p) => [p.svgX, p.svgY, p.haloRadius]),
  svgClusters,
);
assert.equal(
  new Set(lights.map((p) => `${p.longitude},${p.latitude}`)).size,
  lights.length,
);
assert(
  lights.every(
    (p) => Number.isFinite(p.longitude) && Number.isFinite(p.latitude),
  ),
);
for (const [longitude, latitude] of [
  [126.98, 37.57],
  [129.08, 35.18],
  [126.53, 33.5],
])
  assert(
    lights.some(
      (p) =>
        Math.abs(p.longitude - longitude) < 0.000001 &&
        Math.abs(p.latitude - latitude) < 0.000001,
    ),
    'Keep each geographic anchor in the original SVG cluster',
  );
const map = JSON.parse(
  await readFile(
    new URL('../public/trip/korea-10m.json', import.meta.url),
    'utf8',
  ),
);
for (const country of ['South Korea', 'North Korea', 'China', 'Japan'])
  assert(
    map.countries[country]?.length,
    'Missing country silhouette: ' + country,
  );
assert.doesNotMatch(source, /earth-night-vector\.svg/);
assert.doesNotMatch(css, /earth-night-intro\.png|korea-night-map\.png/);
assert.doesNotMatch(page, /setPointerCapture/);
assert.doesNotMatch(
  page,
  /Build the trip together|Illustrative prototype|Use arrow keys/,
);
assert.doesNotMatch(page, /Previous activity|Next activity/);
assert.doesNotMatch(page, /korea-trip-intro-seen/);
assert.doesNotMatch(page, /Five friends|Five fiends|One unforgettable route/);
assert.doesNotMatch(
  page,
  /Skip intro|Search activities|Search places|All regions|region-filter/,
);
assert.match(page, /8500/);
console.log('prototype smoke checks passed');
