import assert from 'node:assert/strict';
import test from 'node:test';
import { sceneDiagnostics } from '../lib/planet-telemetry.ts';

void test('scene diagnostics sample lazily at four hertz and only mutate changed values', () => {
  const writes = [];
  const data = new Proxy(
    {},
    {
      set(target, key, value) {
        writes.push([key, value]);
        target[key] = value;
        return true;
      },
    },
  );
  const publish = sceneDiagnostics(data);
  let samples = 0;
  const snapshot = () => {
    samples++;
    return { draws: '1', routeMode: 'drive' };
  };
  publish(0, snapshot);
  publish(16.7, snapshot);
  publish(249, snapshot);
  assert.equal(samples, 1);
  assert.equal(writes.length, 2);
  publish(250, snapshot);
  assert.equal(samples, 2);
  assert.equal(writes.length, 2);
});

void test('route changes and final camera values publish immediately without resetting unrelated phase state', () => {
  const data = { phase: 'detail' };
  const publish = sceneDiagnostics(data);
  publish(0, () => ({ radius: '12', routeMode: 'drive' }));
  publish(15, () => ({ radius: '300', routeMode: 'bus' }), true);
  assert.deepEqual(data, { phase: 'detail', radius: '300', routeMode: 'bus' });
  publish(20, () => ({ radius: '301', routeMode: 'bus' }));
  assert.equal(data.radius, '300');
  publish(22, () => ({ radius: '318.31', routeMode: 'bus' }), true);
  assert.equal(data.radius, '318.31');
});
