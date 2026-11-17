import assert from 'node:assert/strict';
import { readFile, writeFile } from 'node:fs/promises';

const root = new URL('../public/trip/', import.meta.url);
const reference = JSON.parse(
  await readFile(new URL('korea-svg-reference.json', root), 'utf8'),
);
const { countries } = JSON.parse(
  await readFile(new URL('korea-10m.json', root), 'utf8'),
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
const land = (longitude, latitude) =>
  countries['South Korea'].some(
    (polygon) =>
      insideRing(longitude, latitude, polygon[0]) &&
      !polygon.slice(1).some((ring) => insideRing(longitude, latitude, ring)),
  );
const solve = (coordinate) => {
  const rows = reference.anchors.map((anchor) => [
    ...anchor.svg,
    1,
    anchor[coordinate],
  ]);
  for (let column = 0; column < 3; column += 1) {
    let pivot = column;
    for (let row = column + 1; row < 3; row += 1)
      if (Math.abs(rows[row][column]) > Math.abs(rows[pivot][column]))
        pivot = row;
    [rows[column], rows[pivot]] = [rows[pivot], rows[column]];
    const divisor = rows[column][column];
    assert(
      Math.abs(divisor) > 1e-12,
      'SVG registration anchors must not be collinear',
    );
    for (let cell = column; cell < 4; cell += 1) rows[column][cell] /= divisor;
    for (let row = 0; row < 3; row += 1) {
      if (row === column) continue;
      const multiple = rows[row][column];
      for (let cell = column; cell < 4; cell += 1)
        rows[row][cell] -= multiple * rows[column][cell];
    }
  }
  return rows.map((row) => row[3]);
};
const longitudeCoefficients = solve('longitude');
const latitudeCoefficients = solve('latitude');
const axisX = [longitudeCoefficients[0], latitudeCoefficients[0]];
const axisY = [longitudeCoefficients[1], latitudeCoefficients[1]];
const radiusScaleDegrees = Math.sqrt(
  Math.abs(axisX[0] * axisY[1] - axisY[0] * axisX[1]),
);
const geographic = (svgX, svgY) => ({
  longitude:
    longitudeCoefficients[0] * svgX +
    longitudeCoefficients[1] * svgY +
    longitudeCoefficients[2],
  latitude:
    latitudeCoefficients[0] * svgX +
    latitudeCoefficients[1] * svgY +
    latitudeCoefficients[2],
});
const distance = (a, b) =>
  ((a.longitude - b.longitude) * 0.8) ** 2 + (a.latitude - b.latitude) ** 2;
const nearestShore = (raw) => {
  let shore,
    closest = Infinity;
  for (const polygon of countries['South Korea'])
    for (const ring of polygon) {
      for (let i = 1; i < ring.length; i += 1) {
        const [a, b] = [ring[i - 1], ring[i]];
        const dx = (b[0] - a[0]) * 0.8,
          dy = b[1] - a[1];
        const length = dx * dx + dy * dy;
        const t = length
          ? Math.max(
              0,
              Math.min(
                1,
                ((raw.longitude - a[0]) * 0.8 * dx +
                  (raw.latitude - a[1]) * dy) /
                  length,
              ),
            )
          : 0;
        const point = {
          longitude: a[0] + (b[0] - a[0]) * t,
          latitude: a[1] + (b[1] - a[1]) * t,
        };
        const gap = distance(raw, point);
        if (gap < closest) {
          closest = gap;
          shore = point;
        }
      }
    }
  return { shore, closest };
};
const onLand = (raw) => {
  if (land(raw.longitude, raw.latitude)) return raw;
  const { shore, closest } = nearestShore(raw);
  assert(
    shore && closest < 0.2 ** 2,
    'Original SVG point is too far from Korean land',
  );
  // The old SVG was stylized; preserve its exact raw location and disclose coastal correction.
  for (const radius of [0.0001, 0.001, 0.01])
    for (let i = 0; i < 32; i += 1) {
      const angle = (i / 32) * Math.PI * 2;
      const point = {
        longitude: shore.longitude + (Math.cos(angle) * radius) / 0.8,
        latitude: shore.latitude + Math.sin(angle) * radius,
      };
      if (land(point.longitude, point.latitude)) return point;
    }
  throw new Error('Unable to place recovered SVG point on land');
};
const pointRecord = (svgX, svgY) => {
  const raw = geographic(svgX, svgY),
    placed = onLand(raw);
  const point = {
    longitude: +placed.longitude.toFixed(6),
    latitude: +placed.latitude.toFixed(6),
  };
  assert(land(point.longitude, point.latitude));
  if (placed === raw) return point;
  return {
    ...point,
    unadjustedLongitude: +raw.longitude.toFixed(6),
    unadjustedLatitude: +raw.latitude.toFixed(6),
    coastAdjustmentDegrees: +Math.sqrt(distance(raw, point)).toFixed(6),
  };
};
const clusters = reference.clusters.map(
  ([svgX, svgY, haloRadius], clusterIndex) => ({
    ...pointRecord(svgX, svgY),
    svgX,
    svgY,
    haloRadius,
    clusterIndex,
    radiusDegrees: haloRadius * radiusScaleDegrees,
    intensity: 1,
    group: `svg-cluster-${clusterIndex}`,
  }),
);
const sourceCores = clusters.flatMap((cluster) => [
  {
    ...cluster,
    radius: reference.core.radius,
    radiusDegrees: reference.core.radius * radiusScaleDegrees,
    satellite: false,
  },
  {
    ...pointRecord(
      cluster.svgX + reference.core.satelliteOffset[0],
      cluster.svgY + reference.core.satelliteOffset[1],
    ),
    svgX: cluster.svgX + reference.core.satelliteOffset[0],
    svgY: cluster.svgY + reference.core.satelliteOffset[1],
    radius: reference.core.satelliteRadius,
    radiusDegrees: reference.core.satelliteRadius * radiusScaleDegrees,
    haloRadius: 0,
    clusterIndex: cluster.clusterIndex,
    intensity: 1,
    group: cluster.group,
    satellite: true,
  },
]);
const sourceCount = 20000;
const targetCount = 12492;
const activityAnchors = [
  ...reference.anchors.map((anchor) => ({
    ...anchor,
    clusterIndex: { seoul: 0, busan: 5, jeju: 7 }[anchor.id],
  })),
  { id: 'temple', longitude: 129.22, latitude: 35.86, clusterIndex: 4 },
  { id: 'yangyang', longitude: 128.62, latitude: 38.08, clusterIndex: 8 },
];
let lights = activityAnchors.map(
  ({ id, longitude, latitude, clusterIndex }) => ({
    longitude,
    latitude,
    clusterIndex,
    group: `svg-cluster-${clusterIndex}`,
    anchor: true,
    activityId: id,
  }),
);
const keys = new Set(
  lights.map((point) => `${point.longitude},${point.latitude}`),
);
let state = 0x20261114;
const random = () => {
  state = (state + 0x6d2b79f5) >>> 0;
  let value = state;
  value = Math.imul(value ^ (value >>> 15), value | 1);
  value ^= value + Math.imul(value ^ (value >>> 7), value | 61);
  return (((value ^ (value >>> 14)) >>> 0) + 0.5) / 4294967296;
};
const totalWeight = clusters.reduce(
  (sum, cluster) => sum + cluster.haloRadius ** 3,
  0,
);
const sourceLandCoverageCount = 13600;
const landCoverageCount = 6732;
const coordinates = countries['South Korea'].flat(2);
const bounds = {
  west: Math.min(...coordinates.map(([x]) => x)),
  east: Math.max(...coordinates.map(([x]) => x)),
  south: Math.min(...coordinates.map(([, y]) => y)),
  north: Math.max(...coordinates.map(([, y]) => y)),
};
let attempts = 0;
while (lights.length < sourceCount && attempts++ < sourceCount * 50) {
  const coveragePoint =
    lights.length < activityAnchors.length + sourceLandCoverageCount;
  let raw,
    cluster,
    radial = 0;
  if (coveragePoint) {
    raw = {
      longitude: bounds.west + random() * (bounds.east - bounds.west),
      latitude: bounds.south + random() * (bounds.north - bounds.south),
    };
    // A soft eastern ridge stays darker without cutting a polygon-shaped hole.
    const ridgeLongitude = 128.8 - (raw.latitude - 36) * 0.26;
    const ridge =
      Math.exp(-0.5 * ((raw.longitude - ridgeLongitude) / 0.15) ** 2) *
      Math.max(0, Math.min(1, raw.latitude - 35.2));
    if (random() < ridge * 0.82) continue;
    cluster = clusters.reduce((closest, candidate) =>
      distance(raw, candidate) < distance(raw, closest) ? candidate : closest,
    );
  } else {
    let selection = random() * totalWeight;
    cluster =
      clusters.find(
        (candidate) => (selection -= candidate.haloRadius ** 3) <= 0,
      ) ?? clusters.at(-1);
    radial = Math.sqrt(-2 * Math.log(random()));
    if (radial > 4) continue;
    const angle = random() * Math.PI * 2;
    const sigma = cluster.haloRadius * (random() < 0.18 ? 0.85 : 0.45);
    raw = geographic(
      cluster.svgX + Math.cos(angle) * radial * sigma,
      cluster.svgY + Math.sin(angle) * radial * sigma,
    );
  }
  const longitude = +raw.longitude.toFixed(6),
    latitude = +raw.latitude.toFixed(6);
  const key = `${longitude},${latitude}`;
  // Reject offshore samples; never snap the national field onto a coastline or grid.
  if (keys.has(key) || !land(longitude, latitude)) continue;
  keys.add(key);
  lights.push({
    longitude,
    latitude,
    clusterIndex: cluster.clusterIndex,
    brightness: +(
      coveragePoint
        ? 0.18 + 0.82 * random() ** 1.15
        : 0.22 + 0.78 * random() ** 0.46
    ).toFixed(4),
    size: +(0.5 + random() ** 2).toFixed(4),
    group: coveragePoint ? 'land-coverage' : cluster.group,
  });
}
// Draw anchor brightness after placement so the accepted geographic random sequence stays unchanged.
for (const point of lights.slice(0, activityAnchors.length))
  point.brightness = +(0.22 + 0.78 * random() ** 0.46).toFixed(4);
for (const point of lights.slice(0, activityAnchors.length))
  point.size = +(0.5 + random() ** 2).toFixed(4);
// Generation order is random spatially; dropping every tenth keeps retained positions and brightness intact.
lights = lights.filter((_, index) => index % 10 !== 9);
// Thin only the randomized background field; all accepted city lights remain intact.
let dispersedIndex = 0;
lights = lights.filter(
  (point) => point.group !== 'land-coverage' || dispersedIndex++ % 20 < 11,
);
assert.equal(clusters.length, 10);
assert.equal(sourceCores.length, 20);
assert.equal(lights.length, targetCount);
assert.equal(
  new Set(lights.map((point) => `${point.longitude},${point.latitude}`)).size,
  targetCount,
);
assert(
  lights.every(
    (point) =>
      Number.isFinite(point.longitude) &&
      Number.isFinite(point.latitude) &&
      land(point.longitude, point.latitude),
  ),
);
const around = (longitude, latitude, radius) =>
  lights.filter(
    (point) => distance(point, { longitude, latitude }) < radius ** 2,
  ).length;
const cityCounts = {
  seoul: around(126.98, 37.57, 0.13),
  busan: around(129.08, 35.18, 0.13),
  seosan: around(126.45, 36.78, 0.13),
  hamyang: around(127.73, 35.52, 0.13),
};
assert(
  cityCounts.seoul > cityCounts.busan &&
    cityCounts.busan > Math.max(cityCounts.seosan, cityCounts.hamyang) * 2,
  'City density hierarchy must remain visible',
);
for (const cluster of clusters.filter(
  (point) => ![0, 1, 5].includes(point.clusterIndex),
))
  assert(
    cityCounts.busan >= around(cluster.longitude, cluster.latitude, 0.13),
    'Smaller original clusters must stay below the Busan hub density',
  );
for (const anchor of reference.anchors.filter((point) => point.id !== 'jeju')) {
  const centerDensity =
    around(anchor.longitude, anchor.latitude, 0.13) / 0.13 ** 2;
  const outerDensity =
    (around(anchor.longitude, anchor.latitude, 0.4) -
      around(anchor.longitude, anchor.latitude, 0.25)) /
    (0.4 ** 2 - 0.25 ** 2);
  assert(
    centerDensity > outerDensity * 1.2,
    'City density must taper smoothly toward its edge',
  );
}
const bins = new Map();
for (const point of lights) {
  const key = `${Math.floor(point.longitude / 0.1)},${Math.floor(point.latitude / 0.1)}`;
  bins.set(key, (bins.get(key) ?? 0) + 1);
}
const maximumCellCount = Math.max(...bins.values());
assert(
  maximumCellCount < targetCount * 0.02,
  'Small lights must not collapse into a few dense cells',
);
const coastCount = lights.filter(
  (point) => nearestShore(point).closest < 0.005 ** 2,
).length;
assert(
  coastCount / lights.length < 0.1,
  'Bulk lights must not crowd the coastline',
);
assert(
  lights.every(
    (point) =>
      point.brightness >= 0.18 &&
      point.brightness <= 1 &&
      point.size >= 0.5 &&
      point.size <= 1.5,
  ),
);
for (const anchor of reference.anchors) {
  const point = geographic(...anchor.svg);
  assert(
    Math.abs(point.longitude - anchor.longitude) < 1e-9 &&
      Math.abs(point.latitude - anchor.latitude) < 1e-9,
  );
}
await writeFile(
  new URL('korea-lights.json', root),
  JSON.stringify(
    {
      source: `Synthesized ${targetCount} small lights: ${landCoverageCount} irregular land-coverage points fill the country between cities, with the remaining points weighted by original SVG city centers and halo footprints. A smooth approximate eastern ridge reduces density without a hard cutout. Original SVG/20-core metadata is reference only; this is decorative geography, not measured light or terrain data. Off-land samples are rejected, never snapped to coasts or a grid.`,
      sourceSVG: reference,
      registration: {
        method:
          'Three-anchor affine registration from stylized SVG to Seoul, Busan and Jeju; not original measured geography.',
        longitudeCoefficients,
        latitudeCoefficients,
        axisX,
        axisY,
        radiusScaleDegrees,
      },
      clusters,
      sourceCores,
      sampling: {
        seed: '0x20261114',
        method:
          '6,732 quieter irregular land-coverage points with a soft eastern ridge; 5,760 preserved SVG-weighted city lights; global land rejection',
        landCoverageCount,
        size: 'Independent seeded0.5–1.5 size multipliers, biased toward small points, including anchors.',
        thinning:
          'Keep the accepted city field after the original10% reduction; retain11of every20dispersed entries in randomized order. Every retained position,size,brightness and anchor is unchanged.',
        brightness:
          'Independent seeded per-point levels: land0.18–1, cities0.22–1; layer means retain the subdued city/land balance. Includes anchor stars.',
        componentMassExponent: 3,
        sigmaToHaloRadius: 0.45,
        diffuseTailProbability: 0.18,
        diffuseSigmaToHaloRadius: 0.85,
        maximumSigma: 4,
      },
      diagnostics: {
        cityCounts,
        maximumPointCountIn01DegreeCell: maximumCellCount,
        pointsWithin0005DegreesOfCoast: coastCount,
      },
      lights,
    },
    null,
    2,
  ) + '\n',
);
console.log(
  `Generated ${lights.length} small lights from ${clusters.length} original SVG footprints in ${attempts} attempts; ${sourceCores.length} original cores retained as reference only`,
);
