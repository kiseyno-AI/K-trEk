import test from 'node:test';
import assert from 'node:assert/strict';
import { routeRibbon, mapRouteFor, routeMesh } from '../lib/route-ribbon.ts';

void test('the selected travel option supplies its own geometry and mixed legs stay disconnected and labeled', () => {
  const bus = {
    mode: 'bus',
    path: [
      [126.98, 37.55],
      [127, 37.56],
    ],
  };
  const subway = {
    mode: 'subway',
    path: [
      [127.001, 37.56],
      [127.04, 37.52],
    ],
  };
  const route = {
    activityId: 'samwon',
    provider: 'kakao',
    path: [
      [126.97, 37.55],
      [127.03, 37.52],
    ],
    transitOptions: [{ mode: 'bus_and_subway', segments: [bus, subway] }],
  };
  assert.deepEqual(mapRouteFor(route, 'drive').segments, [
    { mode: 'drive', path: route.path },
  ]);
  const mixed = mapRouteFor(route, 'bus_and_subway');
  assert.deepEqual(mixed.segments, [bus, subway]);
  const mesh = routeMesh(mixed.segments);
  assert.equal(mesh.vertices.length, 96);
  assert.deepEqual(
    mesh.ranges.map(({ mode, start, count }) => ({ mode, start, count })),
    [
      { mode: 'bus', start: 0, count: 6 },
      { mode: 'subway', start: 6, count: 6 },
    ],
  );
  assert.equal(mapRouteFor(route, 'subway'), null);
  assert.equal(
    mapRouteFor(
      { ...route, transitOptions: [{ mode: 'bus', segments: [] }] },
      'bus',
    ),
    null,
  );
});

void test('a geographic road becomes a bounded-width quad with continuous distance for flow', () => {
  const path = [
    [0, 0],
    [0, 1],
  ];
  const ribbon = routeRibbon(path);
  assert.equal(ribbon.vertices.length, 48);
  assert.ok(Math.abs(ribbon.lengthKm - 111.195) < 0.002);
  assert.deepEqual(
    Array.from(ribbon.vertices.slice(0, 6)),
    [0, 0, 0, 1, 0, -1],
  );
  assert.deepEqual(
    Array.from(ribbon.vertices.slice(8, 14)),
    [0, 0, 0, 1, 1, -1],
  );
  assert.deepEqual(path, [
    [0, 0],
    [0, 1],
  ]);
});

void test('many separate legs of the same mode share one render batch without drawing connections between them', () => {
  const mesh = routeMesh([
    {
      mode: 'bus',
      path: [
        [127, 37],
        [127.01, 37],
      ],
    },
    {
      mode: 'walk',
      path: [
        [127.01, 37],
        [127.02, 37],
      ],
    },
    {
      mode: 'bus',
      path: [
        [127.02, 37],
        [127.03, 37],
      ],
    },
  ]);
  assert.deepEqual(
    mesh.ranges.map(({ mode, start, count }) => ({ mode, start, count })),
    [
      { mode: 'bus', start: 0, count: 12 },
      { mode: 'walk', start: 12, count: 6 },
    ],
  );
  assert.equal(mesh.vertices.length, 144);
  assert.ok(Math.abs(mesh.vertices[48] - 127.02) < 0.00001);
});

void test('repeated points do not create invalid segments and all joins share the same flow distance', () => {
  const result = routeRibbon([
    [127, 37],
    [127, 37],
    [127.01, 37],
    [127.01, 37.01],
  ]);
  assert.equal(result.vertices.length, 96);
  assert.equal(result.vertices[7], result.vertices[48 + 6]);
  assert.ok([...result.vertices].every(Number.isFinite));
  for (const points of [
    [],
    [[127, 37]],
    [
      [127, 37],
      [127, 37],
    ],
  ]) {
    assert.equal(routeRibbon(points).vertices.length, 0);
    assert.equal(routeRibbon(points).lengthKm, 0);
  }
});
