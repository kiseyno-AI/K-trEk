import { readFile } from 'node:fs/promises';
import assert from 'node:assert/strict';
import test from 'node:test';
import {
  cameraForDetail,
  separateJourneyLabels,
  placeJourneyLabels,
  cameraForKorea,
  interpolateCamera,
  ORBIT,
  SEOUL_STATION as SEOUL,
  projectLocation,
} from '../lib/planet-camera.ts';

void test('journey labels avoid a route crossing the whole map instead of hiding it under endpoint text', () => {
  const [a, b] = placeJourneyLabels(
    { x: 150, y: 180, width: 140, height: 40 },
    { x: 300, y: 180, width: 140, height: 40 },
    { left: 8, top: 90, right: 580, bottom: 600 },
    [
      [
        { x: 0, y: 180 },
        { x: 600, y: 180 },
      ],
    ],
  );
  for (const rect of [a, b]) {
    assert.ok(rect.y + rect.height <= 174 || rect.y >= 186);
    assert.ok(rect.x >= 8 && rect.x + rect.width <= 580);
    assert.ok(rect.y >= 90 && rect.y + rect.height <= 600);
  }
  assert.ok(
    a.x + a.width + 8 <= b.x ||
      b.x + b.width + 8 <= a.x ||
      a.y + a.height + 8 <= b.y ||
      b.y + b.height + 8 <= a.y,
  );
});

void test('narrow-map journey labels clear each other, the route and the panel frame', () => {
  const boxes = placeJourneyLabels(
    { x: 135, y: 145, width: 145, height: 38 },
    { x: 180, y: 145, width: 145, height: 38 },
    { left: 8, top: 90, right: 312, bottom: 199 },
    [
      [
        { x: 0, y: 145 },
        { x: 320, y: 145 },
      ],
    ],
  );
  for (const rect of boxes) {
    assert.ok(rect.x >= 8 && rect.x + rect.width <= 312);
    assert.ok(rect.y >= 90 && rect.y + rect.height <= 199);
    assert.ok(rect.y + rect.height <= 139 || rect.y >= 151);
  }
  const [a, b] = boxes;
  assert.ok(
    a.x + a.width + 8 <= b.x ||
      b.x + b.width + 8 <= a.x ||
      a.y + a.height + 8 <= b.y ||
      b.y + b.height + 8 <= a.y,
  );
});

void test('detail camera frames a configured departure rather than retaining Seoul Station', () => {
  const origin = {
    name: 'Busan departure',
    longitude: 129.08,
    latitude: 35.19,
  };
  const camera = cameraForDetail(129.06, 35.18, 1440, 900, [], origin);
  assert.ok(camera.radius > 250);
  assert.ok(camera.longitude > 129 && camera.latitude < 35.3);
  for (const point of [origin, { longitude: 129.06, latitude: 35.18 }]) {
    const p = projectLocation(
      camera,
      point.longitude,
      point.latitude,
      1440,
      900,
    );
    assert.ok(p.visible && p.x >= 43 && p.x <= 662 && p.y >= 153 && p.y <= 756);
  }
});

void test('entering Korea magnifies the same globe and leaves room for the guide', () => {
  const camera = cameraForKorea(1440, 900, 1);
  assert.equal(camera.longitude, 127.7);
  assert.equal(camera.latitude, 36.5);
  assert.equal(camera.anchorX, 0.36);
  assert.equal(camera.anchorY, 0.5);
  assert.ok(camera.radius > ORBIT.radius);
  assert.ok(Math.abs(camera.radius - 16.38040823939838) < 1e-10);
});

const activities = [
  { id: 'temple', longitude: 129.22, latitude: 35.86 },
  { id: 'jeju', longitude: 126.53, latitude: 33.5 },
  { id: 'busan', longitude: 129.08, latitude: 35.18 },
  { id: 'seoul', longitude: 126.98, latitude: 37.57 },
  { id: 'yangyang', longitude: 128.62, latitude: 38.08 },
];

const frames = [
  {
    width: 1440,
    height: 900,
    left: 0.03,
    right: 0.46,
    top: 0.17,
    bottom: 0.84,
  },
  {
    width: 1024,
    height: 768,
    left: 0.03,
    right: 0.46,
    top: 0.17,
    bottom: 0.84,
  },
  { width: 760, height: 844, left: 0.06, right: 0.94, top: 0.12, bottom: 0.34 },
  { width: 390, height: 844, left: 0.06, right: 0.94, top: 0.12, bottom: 0.34 },
  { width: 320, height: 568, left: 0.06, right: 0.94, top: 0.12, bottom: 0.34 },
];

for (const activity of activities) {
  for (const frame of frames) {
    void test(`${activity.id} detail keeps Seoul and destination in the visible map at ${frame.width}px`, () => {
      const camera = cameraForDetail(
        activity.longitude,
        activity.latitude,
        frame.width,
        frame.height,
      );
      for (const location of [SEOUL, activity]) {
        const point = projectLocation(
          camera,
          location.longitude,
          location.latitude,
          frame.width,
          frame.height,
        );
        assert.equal(point.visible, true);
        assert.ok(
          point.x >= frame.left * frame.width &&
            point.x <= frame.right * frame.width,
        );
        assert.ok(
          point.y >= frame.top * frame.height &&
            point.y <= frame.bottom * frame.height,
        );
      }
      if (frame.width > 760) {
        assert.ok(
          camera.anchorX < cameraForKorea(frame.width, frame.height, 1).anchorX,
        );
      }
    });
  }
}

void test('camera transitions have exact endpoints and a smooth multiplicative zoom', () => {
  const end = {
    ...ORBIT,
    longitude: 129.5,
    latitude: 38,
    radius: 72,
    anchorX: 0.24,
    anchorY: 0.5,
  };
  assert.deepEqual(interpolateCamera(ORBIT, end, 0), ORBIT);
  assert.deepEqual(interpolateCamera(ORBIT, end, 1), end);
  assert.deepEqual(interpolateCamera(ORBIT, end, -1), ORBIT);
  assert.deepEqual(interpolateCamera(ORBIT, end, 2), end);
  const halfway = interpolateCamera(ORBIT, end, 0.5);
  assert.ok(Math.abs(halfway.radius - 7.2) < 1e-10);
  assert.equal(halfway.longitude, 128.5);
  assert.equal(halfway.latitude, 37);
  assert.equal(halfway.anchorX, 0.38125);
});

void test('national zoom retains its delivered source resolution limit', () => {
  // 3072 native pixels over 13.5°: 1800 backing pixels need a 7.91015625° view.
  assert.ok(
    Math.abs(cameraForKorea(1440, 900, 2).radius - 14.498147852769854) < 1e-10,
  );
});

void test('Seoul stays local while Busan shows the journey from Seoul', () => {
  const seoul = cameraForDetail(SEOUL.longitude, SEOUL.latitude, 1440, 900);
  const busan = cameraForDetail(129.08, 35.18, 1440, 900);
  const nearbySeoul = cameraForDetail(127, 37.59, 1440, 900);
  assert.equal(seoul.longitude, 126.9707793);
  assert.ok(Math.abs(seoul.latitude - 37.5545547) < 1e-10);
  assert.ok(seoul.radius > 250 && seoul.radius < 400);
  assert.equal(nearbySeoul.radius, seoul.radius);
  assert.ok(seoul.radius > busan.radius);
});

void test('mobile detail stays above the lower panel and shares the 760px breakpoint', () => {
  const country = cameraForKorea(760, 844, 2);
  const detail = cameraForDetail(SEOUL.longitude, SEOUL.latitude, 760, 844);
  assert.equal(country.anchorX, 0.5);
  assert.equal(detail.anchorX, 0.5);
  assert.equal(detail.anchorY, 0.23);
  assert.ok(detail.radius > country.radius);
  const point = projectLocation(
    detail,
    SEOUL.longitude,
    SEOUL.latitude,
    760,
    844,
  );
  assert.ok(Math.abs(point.x - 380) < 1e-8);
  assert.ok(Math.abs(point.y - 194.12) < 1e-8);
  assert.equal(cameraForDetail(126.98, 37.57, 761, 844).anchorX, 0.24);
});

void test('projected markers agree with the sphere rotation and hide behind the earth', () => {
  const camera = {
    longitude: 0,
    latitude: 0,
    radius: 1,
    anchorX: 0.5,
    anchorY: 0.5,
  };
  const east = projectLocation(camera, 30, 0, 1000, 1000);
  const north = projectLocation(camera, 0, 30, 1000, 1000);
  assert.ok(Math.abs(east.x - 750) < 1e-8);
  assert.ok(Math.abs(east.y - 500) < 1e-8);
  assert.ok(Math.abs(north.x - 500) < 1e-8);
  assert.ok(Math.abs(north.y - 250) < 1e-8);
  assert.equal(projectLocation(camera, 180, 0, 1000, 1000).visible, false);
  assert.equal(
    projectLocation({ ...camera, radius: 4 }, 30, 0, 1000, 1000).visible,
    false,
  );
});

void test('a reversed or interrupted flight starts at its exact currently displayed camera', () => {
  const country = cameraForKorea(1440, 900, 1);
  const detail = cameraForDetail(126.98, 37.57, 1440, 900);
  let current = interpolateCamera(ORBIT, country, 0.37);
  for (const target of [ORBIT, country, detail, country, detail]) {
    assert.deepEqual(interpolateCamera(current, target, 0), current);
    assert.deepEqual(interpolateCamera(current, target, 1), target);
    const previous = { ...current };
    current = interpolateCamera(current, target, 0.41);
    for (const key of [
      'longitude',
      'latitude',
      'radius',
      'anchorX',
      'anchorY',
    ]) {
      assert.ok(current[key] >= Math.min(previous[key], target[key]));
      assert.ok(current[key] <= Math.max(previous[key], target[key]));
    }
  }
});

void test('zoom and anchors move continuously without overshooting during the whole flight', () => {
  const end = cameraForDetail(126.98, 37.57, 1440, 900);
  let previous = ORBIT;
  for (let frame = 1; frame <= 100; frame += 1) {
    const current = interpolateCamera(ORBIT, end, frame / 100);
    assert.ok(
      current.radius >= previous.radius && current.radius <= end.radius,
    );
    assert.ok(current.radius / previous.radius < 1.07);
    assert.ok(
      current.anchorX <= previous.anchorX && current.anchorX >= end.anchorX,
    );
    assert.ok(previous.anchorX - current.anchorX < 0.003);
    previous = current;
  }
});

void test('crossing the date line takes the short route and still ends on the exact target', () => {
  const start = { ...ORBIT, longitude: 179 };
  const end = { ...ORBIT, longitude: -179 };
  assert.equal(interpolateCamera(start, end, 0.5).longitude, 180);
  assert.deepEqual(interpolateCamera(start, end, 1), end);
});

void test('the trip departs from Seoul Station and close destinations remain distinct', () => {
  assert.ok(Math.abs(SEOUL.longitude - 126.97065) < 0.0002);
  assert.ok(Math.abs(SEOUL.latitude - 37.5547) < 0.0002);
  const palace = { longitude: 126.9769, latitude: 37.5658 };
  for (const frame of frames) {
    const camera = cameraForDetail(
      palace.longitude,
      palace.latitude,
      frame.width,
      frame.height,
    );
    const origin = projectLocation(
      camera,
      SEOUL.longitude,
      SEOUL.latitude,
      frame.width,
      frame.height,
    );
    const destination = projectLocation(
      camera,
      palace.longitude,
      palace.latitude,
      frame.width,
      frame.height,
    );
    assert.ok(
      Math.hypot(origin.x - destination.x, origin.y - destination.y) > 16,
      `${frame.width}px: origin and palace must not collapse into one city marker`,
    );
    assert.ok(
      camera.longitude > SEOUL.longitude && camera.longitude < palace.longitude,
    );
    assert.ok(
      camera.latitude > SEOUL.latitude && camera.latitude < palace.latitude,
    );
  }
});

void test('departure and destination labels remain separate on a short mobile map', () => {
  const origin = { x: 204, y: 104, width: 97, height: 36 };
  const destination = { x: 210, y: 90, width: 145, height: 36 };
  const [a, b] = separateJourneyLabels(origin, destination, 382);
  assert.ok(a.x + a.width + 8 <= b.x || b.x + b.width + 8 <= a.x);
  for (const label of [a, b])
    assert.ok(label.x >= 8 && label.x + label.width <= 382);
  assert.deepEqual(origin, { x: 204, y: 104, width: 97, height: 36 });
  const clearDestination = { ...destination, y: 180 };
  assert.deepEqual(separateJourneyLabels(origin, clearDestination, 382), [
    origin,
    clearDestination,
  ]);
});

void test('the whole driving road fits even when it detours beyond both pins', () => {
  const destination = { longitude: 127.033, latitude: 37.523 };
  const road = [
    [SEOUL.longitude, SEOUL.latitude],
    [126.91, 37.6],
    [127.09, 37.48],
    [destination.longitude, destination.latitude],
  ];
  for (const frame of frames) {
    const camera = cameraForDetail(
      destination.longitude,
      destination.latitude,
      frame.width,
      frame.height,
      road,
    );
    for (const [longitude, latitude] of road) {
      const point = projectLocation(
        camera,
        longitude,
        latitude,
        frame.width,
        frame.height,
      );
      assert.ok(point.visible);
      assert.ok(
        point.x >= frame.left * frame.width &&
          point.x <= frame.right * frame.width,
        'whole road horizontal clearance',
      );
      assert.ok(
        point.y >= frame.top * frame.height &&
          point.y <= frame.bottom * frame.height,
        'whole road vertical clearance',
      );
    }
  }
});

void test('every saved venue fits with Seoul Station beside the panel at all supported sizes', async () => {
  const manifest = JSON.parse(
    await readFile(
      new URL('../data/activity-coordinates.json', import.meta.url),
      'utf8',
    ),
  );
  for (const destination of manifest.activities)
    for (const frame of frames) {
      const camera = cameraForDetail(
        destination.longitude,
        destination.latitude,
        frame.width,
        frame.height,
      );
      for (const endpoint of [SEOUL, destination]) {
        const point = projectLocation(
          camera,
          endpoint.longitude,
          endpoint.latitude,
          frame.width,
          frame.height,
        );
        assert.ok(point.visible, destination.id);
        assert.ok(
          point.x >= frame.left * frame.width &&
            point.x <= frame.right * frame.width,
          destination.id + ' horizontal clearance',
        );
        assert.ok(
          point.y >= frame.top * frame.height &&
            point.y <= frame.bottom * frame.height,
          destination.id + ' vertical clearance',
        );
      }
    }
});
