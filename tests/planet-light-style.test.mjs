import test from 'node:test';
import assert from 'node:assert/strict';
import { lightStyleForZoom } from '../lib/planet-camera.ts';

void test('close views keep individual light cores legible without unbounded growth', () => {
  const national = lightStyleForZoom(16.38);
  const close = lightStyleForZoom(318.31);
  assert.equal(national.pointSize, 10);
  assert.equal(national.strengthBoost, 0);
  assert.ok(close.pointSize >= 20 && close.pointSize <= 24);
  assert.ok(close.strengthBoost >= 0.2 && close.strengthBoost <= 0.3);
  let previous = national;
  for (const radius of [30, 70, 140, 200, 318, 1000]) {
    const current = lightStyleForZoom(radius);
    assert.ok(
      current.pointSize >= previous.pointSize && current.pointSize <= 24,
    );
    assert.ok(
      current.strengthBoost >= previous.strengthBoost &&
        current.strengthBoost <= 0.3,
    );
    previous = current;
  }
});
