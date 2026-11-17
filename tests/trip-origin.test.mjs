import test from 'node:test';
import assert from 'node:assert/strict';
import { configuredTripOrigin, parseTripOrigin, resolveTripOrigin } from '../lib/trip-origin.ts';

void test('listed departures resolve to their verified public meeting points while default keeps a configured origin', () => {
  const hotel = { name: 'Hotel meeting point', longitude: 127.0276, latitude: 37.4979 };
  assert.equal(resolveTripOrigin(null, hotel), hotel);
  assert.equal(resolveTripOrigin('default', hotel), hotel);
  assert.equal(resolveTripOrigin('seoul-station', hotel).name, 'Seoul Station');
  assert.deepEqual(resolveTripOrigin('jongno-1-ga', hotel), {
    name: 'Jongno 1-ga', longitude: 126.9831508, latitude: 37.570228,
  });
  assert.deepEqual(resolveTripOrigin('sinchon-station', hotel), {
    name: 'Sinchon Station', longitude: 126.9369808, latitude: 37.5551982,
  });
  assert.deepEqual(resolveTripOrigin('gangnam-station', hotel), {
    name: 'Gangnam Station', longitude: 127.0280014, latitude: 37.4980863,
  });
  assert.deepEqual(resolveTripOrigin('yangjae-station', hotel), {
    name: 'Yangjae Station', longitude: 127.0341641, latitude: 37.4845768,
  });
  for (const id of ['', 'random-station', '127,37', '__proto__'])
    assert.throws(() => resolveTripOrigin(id, hotel));
});

void test('departure defaults to the existing Seoul terminal and accepts a future named location from server configuration', () => {
  assert.deepEqual(configuredTripOrigin(undefined), {
    name: 'Seoul Station',
    longitude: 126.9707793,
    latitude: 37.5545547,
  });
  assert.deepEqual(
    configuredTripOrigin(
      '{"name":"Hotel meeting point","longitude":127.0276,"latitude":37.4979}',
    ),
    { name: 'Hotel meeting point', longitude: 127.0276, latitude: 37.4979 },
  );
});

void test('invalid configured departure is rejected instead of silently routing from a different point', () => {
  for (const value of [
    '',
    'not-json',
    '{}',
    'null',
    '{"name":"Nowhere","longitude":181,"latitude":37}',
    '{"name":"Nowhere","longitude":127,"latitude":91}',
  ])
    assert.throws(() => configuredTripOrigin(value));
  for (const value of [
    { name: '', longitude: 127, latitude: 37 },
    { name: 'Bad\nLabel', longitude: 127, latitude: 37 },
    { name: 'Bad', longitude: NaN, latitude: 37 },
    { name: 'Bad', longitude: 127, latitude: 37, extra: 'ignored?' },
  ])
    assert.throws(() => parseTripOrigin(value));
});
