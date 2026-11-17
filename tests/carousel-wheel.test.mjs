import assert from 'node:assert/strict';
import test from 'node:test';
import {
  bindCarouselScrollLock,
  carouselWheelGesture,
} from '../lib/carousel-wheel.ts';

void test('the carousel owns ordinary wheel scrolling while pinch zoom and other targets stay native', () => {
  const carousel = new EventTarget();
  const detail = new EventTarget();
  const dispose = bindCarouselScrollLock(carousel);
  const wheel = new Event('wheel', { cancelable: true });
  assert.equal(carousel.dispatchEvent(wheel), false);
  assert.equal(wheel.defaultPrevented, true);
  const pinch = new Event('wheel', { cancelable: true });
  Object.defineProperty(pinch, 'ctrlKey', { value: true });
  assert.equal(carousel.dispatchEvent(pinch), true);
  assert.equal(pinch.defaultPrevented, false);
  const detailWheel = new Event('wheel', { cancelable: true });
  assert.equal(detail.dispatchEvent(detailWheel), true);
  assert.equal(detailWheel.defaultPrevented, false);
  dispose();
  const after = new Event('wheel', { cancelable: true });
  assert.equal(carousel.dispatchEvent(after), true);
  assert.equal(after.defaultPrevented, false);
});

void test('binding uses one non-passive wheel listener and repeated disposal does not retain or duplicate cancellation', () => {
  const carousel = new EventTarget();
  const add = carousel.addEventListener.bind(carousel);
  const registrations = [];
  carousel.addEventListener = (type, listener, options) => {
    registrations.push({ type, options });
    add(type, listener, options);
  };
  let cancellations = 0;
  const wheel = (cancelable = true) => {
    const event = new Event('wheel', { cancelable });
    const prevent = event.preventDefault.bind(event);
    event.preventDefault = () => {
      cancellations++;
      prevent();
    };
    return event;
  };
  for (let i = 0; i < 4; i++) {
    const dispose = bindCarouselScrollLock(carousel);
    assert.equal(registrations.length, i + 1);
    assert.deepEqual(registrations[i], {
      type: 'wheel',
      options: { passive: false },
    });
    assert.equal(carousel.dispatchEvent(wheel()), false);
    assert.equal(cancellations, i + 1);
    assert.equal(carousel.dispatchEvent(wheel(false)), true);
    assert.equal(cancellations, i + 1);
    dispose();
    dispose();
    assert.equal(carousel.dispatchEvent(wheel()), true);
    assert.equal(cancellations, i + 1);
  }
});

void test('a gentle vertical swipe accumulates small packets into one card movement', () => {
  const step = carouselWheelGesture();
  const moves = [4, 5, 5, 5, 3, 2]
    .map((deltaY, i) => step({ timeStamp: 1000 + i * 16, deltaX: 0, deltaY }))
    .filter(Boolean);
  assert.deepEqual(moves, [1]);
});

void test('a slow negative vertical swipe accumulates fractional packets without repeating on its tail', () => {
  const step = carouselWheelGesture();
  const moves = Array.from({ length: 12 }, (_, i) =>
    step({ timeStamp: 1000 + i * 16, deltaX: 0, deltaY: -2.25 }),
  ).filter(Boolean);
  assert.deepEqual(moves, [-1]);
});

void test('a quiet gap resets unfinished displacement on either axis instead of carrying unrelated noise forward', () => {
  for (const axis of ['deltaX', 'deltaY']) {
    const step = carouselWheelGesture();
    const event = (timeStamp, delta) =>
      step({ timeStamp, deltaX: 0, deltaY: 0, [axis]: delta });
    assert.equal(event(1000, 8), 0);
    assert.equal(event(1016, 6), 0);
    assert.deepEqual(
      [4, 5, 5, 5].map((delta, i) => event(1400 + i * 16, delta)),
      [0, 0, 0, 1],
    );
  }
});

void test('diagonal motion accumulates signed vectors and axis jitter cannot trigger a second move', () => {
  const step = carouselWheelGesture();
  const packets = [
    [6, 2],
    [-5, 4],
    [5, 4],
    [-5, 4],
    [5, 5],
    [-100, 0],
  ];
  const results = packets.map(([deltaX, deltaY], i) =>
    step({ timeStamp: 1000 + i * 16, deltaX, deltaY }),
  );
  assert.deepEqual(results, [0, 0, 0, 0, 1, 0]);
});

void test('one continuous trackpad gesture cannot move another card when its momentum outlives the old cooldown', () => {
  const step = carouselWheelGesture();
  const deltas = [90, 70, 55, 40, 28, 20, 9, 3];
  const moves = deltas
    .map((deltaX, i) => step({ timeStamp: 1000 + i * 100, deltaX, deltaY: 2 }))
    .filter(Boolean);
  assert.deepEqual(moves, [1]);
});

void test('decaying diagonal momentum cannot invent a reversal when its dominant axis changes', () => {
  for (const transpose of [false, true]) {
    const step = carouselWheelGesture();
    const moves = [[-32, 60], [-20, 25], [-20, 19]].map(([x, y], i) =>
      step({ timeStamp: [1000, 1100, 1250][i], deltaX: transpose ? y : x, deltaY: transpose ? x : y }),
    );
    assert.deepEqual(moves, [1, 0, 0]);
  }
});

void test('new stationary-cursor swipe bursts rearm while the previous tiny momentum packets continue', () => {
  for (const axis of ['deltaX', 'deltaY']) {
    const step = carouselWheelGesture();
    const moves = [];
    const packet = (timeStamp, delta) => {
      const by = step({ timeStamp, deltaX: 0, deltaY: 0, [axis]: delta });
      if (by) moves.push(by);
    };
    packet(1000, 40);
    packet(1032, 20);
    packet(1100, 2);
    packet(1200, 1);
    for (const start of [1300, 1700, 2100]) {
      for (const [i, delta] of [4, 5, 6, 5, 3, 1].entries())
        packet(start + i * 16, delta);
      packet(start + 160, 1);
      packet(start + 240, 1);
    }
    assert.deepEqual(moves, [1, 1, 1, 1]);
  }
});

void test('a fresh reverse swipe is recognized without pointer motion or a fully silent momentum tail', () => {
  const step = carouselWheelGesture();
  const packet = (timeStamp, deltaY) => step({ timeStamp, deltaX: 0, deltaY });
  assert.equal(packet(1000, 60), 1);
  assert.equal(packet(1100, 25), 0);
  assert.equal(packet(1190, 2), 0);
  assert.equal(packet(1280, 1), 0);
  assert.equal(packet(1350, -35), -1);
  assert.equal(packet(1380, -20), 0);
});

void test('a small decaying momentum rebound cannot turn into a second card or carry into a later swipe', () => {
  const step = carouselWheelGesture();
  const packet = (timeStamp, deltaY) => step({ timeStamp, deltaX: 0, deltaY });
  const moves = [[1000, 60], [1100, 25], [1190, 2], [1280, 1], [1320, 4], [1336, 3], [1352, 2], [1368, 1]]
    .map(([time, delta]) => packet(time, delta)).filter(Boolean);
  for (let time = 1384; time < 1900; time += 16) {
    const by = packet(time, 1);
    if (by) moves.push(by);
  }
  assert.deepEqual(moves, [1]);
  assert.deepEqual([4, 5, 6, 5].map((delta, i) => packet(1920 + i * 16, delta)), [0, 0, 0, 1]);
});

void test('an incomplete renewed stroke expires instead of borrowing later tail displacement', () => {
  const step = carouselWheelGesture();
  const packet = (timeStamp, deltaY) => step({ timeStamp, deltaX: 0, deltaY });
  assert.equal(packet(1000, 60), 1);
  assert.equal(packet(1100, 2), 0);
  assert.equal(packet(1200, 1), 0);
  assert.equal(packet(1300, 4), 0);
  assert.equal(packet(1320, 5), 0);
  assert.equal(packet(1440, 9), 0);
  for (let time = 1460; time < 1800; time += 20)
    assert.equal(packet(time, 1), 0);
  assert.equal(packet(1800, 25), 1);
});

void test('tiny momentum stays latched while a meaningful new reverse gesture can move back', () => {
  const step = carouselWheelGesture();
  const event = (timeStamp, deltaY) => step({ timeStamp, deltaX: 0, deltaY });
  assert.equal(event(1000, 60), 1);
  for (const time of [1190, 1380, 1570, 1760]) assert.equal(event(time, 2), 0);
  assert.equal(event(1900, -30), -1);
  assert.equal(event(2160, -40), -1);
});

void test('the first qualifying event uses the dominant axis and direction changes inside one gesture do not double-step', () => {
  const step = carouselWheelGesture();
  assert.equal(step({ timeStamp: 10, deltaX: 5, deltaY: 2 }), 0);
  assert.equal(step({ timeStamp: 30, deltaX: -45, deltaY: 3 }), -1);
  assert.equal(step({ timeStamp: 60, deltaX: 2, deltaY: 80 }), 0);
  assert.equal(step({ timeStamp: 320, deltaX: 2, deltaY: 30 }), 1);
});
