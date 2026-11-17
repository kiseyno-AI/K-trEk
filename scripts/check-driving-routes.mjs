import assert from 'node:assert/strict';

// Run after both servers start; this checks the same endpoints used by the cards.
for (const [name, origin] of [
  ['local', 'http://localhost:3000'],
  ['public', 'https://shawnai.win/ktravel'],
]) {
  const response = await fetch(`${origin}/directions/food-samwon-garden`, {
    signal: AbortSignal.timeout(12000),
    cache: 'no-store',
  });
  const route = await response.json();
  assert.ok(response.ok, `${name}: HTTP ${response.status}, ${route.status}`);
  assert.equal(route.status, 'ok', name);
  assert.equal(route.provider, 'kakao', name);
  assert.equal(route.activityId, 'food-samwon-garden', name);
  assert.ok(route.path.length > 1, `${name}: missing road geometry`);
  assert.ok(
    Number.isFinite(route.durationSeconds) && route.durationSeconds >= 0,
    name,
  );
  assert.ok(
    Number.isFinite(route.distanceMeters) && route.distanceMeters >= 0,
    name,
  );
  console.log(
    `${name}: Kakao route OK, ${route.path.length} vertices, ${Math.ceil(route.durationSeconds / 60)} min`,
  );
}
