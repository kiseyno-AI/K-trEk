import test from 'node:test';
import assert from 'node:assert/strict';
import { sitePath } from '../lib/site-path.ts';

await test('public subpath assets stay under ktravel while external photo URLs remain unchanged', () => {
  const prior = process.env.__NEXT_ROUTER_BASEPATH;
  try {
    process.env.__NEXT_ROUTER_BASEPATH = '/ktravel';
    assert.equal(
      sitePath('/trip/photos/seoul.webp'),
      '/ktravel/trip/photos/seoul.webp',
    );
    assert.equal(sitePath('/api/activities'), '/ktravel/api/activities');
    assert.equal(
      sitePath('https://example.com/image.jpg'),
      'https://example.com/image.jpg',
    );
    delete process.env.__NEXT_ROUTER_BASEPATH;
    assert.equal(
      sitePath('/trip/korea-lights.json'),
      '/trip/korea-lights.json',
    );
  } finally {
    if (prior === undefined) delete process.env.__NEXT_ROUTER_BASEPATH;
    else process.env.__NEXT_ROUTER_BASEPATH = prior;
  }
});
