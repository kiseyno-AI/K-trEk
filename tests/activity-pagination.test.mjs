import assert from 'node:assert/strict';
import test from 'node:test';
import {
  activityPage,
  wholeGridPageSize,
  observeGridPageSize,
} from '../lib/activity-pagination.ts';

void test('only complete rows contribute cards to a page', () => {
  assert.equal(wholeGridPageSize(5, 383, 144, 16), 10);
  assert.equal(wholeGridPageSize(5, 303, 144, 16), 5);
  assert.equal(wholeGridPageSize(5, 304, 144, 16), 10);
  assert.equal(wholeGridPageSize(5, 464, 144, 16), 15);
  assert.equal(wholeGridPageSize(1, 407, 128, 12), 2);
  assert.equal(wholeGridPageSize(1, 408, 128, 12), 3);
  assert.equal(wholeGridPageSize(1, 127, 128, 12), 0);
});

void test('measured pages resize to whole rows and release their observer on unmount', (t) => {
  const descriptors = Object.fromEntries(
    ['getComputedStyle', 'ResizeObserver'].map((key) => [
      key,
      Object.getOwnPropertyDescriptor(globalThis, key),
    ]),
  );
  t.after(() => {
    for (const [key, descriptor] of Object.entries(descriptors)) {
      if (descriptor) Object.defineProperty(globalThis, key, descriptor);
      else delete globalThis[key];
    }
  });
  const node = { clientHeight: 391 };
  const style = {
    gridTemplateColumns: '350px 350px 350px 350px 350px',
    paddingTop: '4px',
    paddingBottom: '4px',
    gridAutoRows: '144px',
    rowGap: '16px',
  };
  let resize;
  let disconnects = 0;
  globalThis.getComputedStyle = () => style;
  globalThis.ResizeObserver = class {
    constructor(callback) {
      resize = callback;
    }
    observe(target) {
      assert.equal(target, node);
    }
    disconnect() {
      disconnects++;
    }
  };
  const sizes = [];
  const dispose = observeGridPageSize(node, (size) => sizes.push(size));
  assert.deepEqual(sizes, [10]);
  node.clientHeight = 472;
  resize();
  assert.deepEqual(sizes, [10, 15]);
  dispose();
  resize();
  assert.equal(disconnects, 1);
  assert.deepEqual(sizes, [10, 15]);
});

void test('a smaller visible grid moves every remaining activity to subsequent pages', () => {
  const activities = Array.from({ length: 114 }, (_, i) => i + 1);
  assert.deepEqual(activityPage(activities, 2, 10), {
    items: [11, 12, 13, 14, 15, 16, 17, 18, 19, 20],
    page: 2,
    pageCount: 12,
    start: 10,
  });
  assert.deepEqual(activityPage(activities, 12, 10), {
    items: [111, 112, 113, 114],
    page: 12,
    pageCount: 12,
    start: 110,
  });
});

void test('grid measurement keeps a removable resize fallback when ResizeObserver is unavailable', (t) => {
  const keys = ['getComputedStyle', 'ResizeObserver', 'window'];
  const descriptors = Object.fromEntries(
    keys.map((key) => [key, Object.getOwnPropertyDescriptor(globalThis, key)]),
  );
  t.after(() => {
    for (const [key, descriptor] of Object.entries(descriptors)) {
      if (descriptor) Object.defineProperty(globalThis, key, descriptor);
      else delete globalThis[key];
    }
  });
  const node = { clientHeight: 416 };
  globalThis.getComputedStyle = () => ({
    gridTemplateColumns: '350px',
    paddingTop: '4px',
    paddingBottom: '4px',
    gridAutoRows: '128px',
    rowGap: '12px',
  });
  globalThis.ResizeObserver = undefined;
  globalThis.window = new EventTarget();
  const sizes = [];
  const dispose = observeGridPageSize(node, (size) => sizes.push(size));
  assert.deepEqual(sizes, [3]);
  node.clientHeight = 300;
  window.dispatchEvent(new Event('resize'));
  assert.deepEqual(sizes, [3, 2]);
  dispose();
  window.dispatchEvent(new Event('resize'));
  assert.deepEqual(sizes, [3, 2]);
});

void test('sixteen activities split into a full first page and one remaining card', () => {
  const activities = [
    'a',
    'b',
    'c',
    'd',
    'e',
    'f',
    'g',
    'h',
    'i',
    'j',
    'k',
    'l',
    'm',
    'n',
    'o',
    'p',
  ];
  assert.deepEqual(activityPage(activities, 1), {
    items: [
      'a',
      'b',
      'c',
      'd',
      'e',
      'f',
      'g',
      'h',
      'i',
      'j',
      'k',
      'l',
      'm',
      'n',
      'o',
    ],
    page: 1,
    pageCount: 2,
    start: 0,
  });
  assert.deepEqual(activityPage(activities, 2), {
    items: ['p'],
    page: 2,
    pageCount: 2,
    start: 15,
  });
  assert.equal(activities.length, 16);
});

void test('the last page is clamped when filtered results get shorter', () => {
  const activities = Array.from({ length: 114 }, (_, i) => i + 1);
  assert.deepEqual(activityPage(activities, 99), {
    items: [106, 107, 108, 109, 110, 111, 112, 113, 114],
    page: 8,
    pageCount: 8,
    start: 105,
  });
  assert.deepEqual(activityPage(activities.slice(0, 15), 8), {
    items: [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14, 15],
    page: 1,
    pageCount: 1,
    start: 0,
  });
  assert.deepEqual(activityPage([], 8), {
    items: [],
    page: 1,
    pageCount: 1,
    start: 0,
  });
});
