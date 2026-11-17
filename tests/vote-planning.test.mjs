import assert from 'node:assert/strict';
import test from 'node:test';
import { readFile } from 'node:fs/promises';
import {
  MAX_VOTES,
  VOTE_DEADLINE_ISO,
  remainingTime,
  formatCountdown,
  formatDistance,
} from '../lib/vote-planning.ts';

void test('the vote closes at the end of January 15 in New York and permits twenty picks', () => {
  assert.equal(MAX_VOTES, 20);
  assert.equal(VOTE_DEADLINE_ISO, '2027-01-16T04:59:59Z');
  assert.deepEqual(remainingTime(Date.parse('2027-01-15T03:57:56Z')), {
    days: 1,
    hours: 25,
    minutes: 2,
    seconds: 3,
    expired: false,
  });
});

void test('the cinematic clock converts every day into hours instead of wrapping at midnight', () => {
  const deadline = Date.parse(VOTE_DEADLINE_ISO);
  assert.equal(
    formatCountdown(remainingTime(deadline - 5227201000)),
    '1452:00:01',
  );
  assert.equal(formatCountdown(remainingTime(deadline - 90061000)), '25:01:01');
  assert.equal(formatCountdown(remainingTime(deadline - 1000)), '00:00:01');
  assert.equal(formatCountdown(remainingTime(deadline + 1000)), '00:00:00');
});

void test('the clock changes by one second, carries into the next minute and stops at zero', () => {
  const deadline = Date.parse('2027-01-16T04:59:59Z');
  assert.deepEqual(remainingTime(deadline - 61000), {
    days: 0,
    hours: 0,
    minutes: 1,
    seconds: 1,
    expired: false,
  });
  assert.deepEqual(remainingTime(deadline - 60000), {
    days: 0,
    hours: 0,
    minutes: 1,
    seconds: 0,
    expired: false,
  });
  assert.deepEqual(remainingTime(deadline - 1), {
    days: 0,
    hours: 0,
    minutes: 0,
    seconds: 1,
    expired: false,
  });
  for (const now of [deadline, deadline + 1000, deadline + 86400000])
    assert.deepEqual(remainingTime(now), {
      days: 0,
      hours: 0,
      minutes: 0,
      seconds: 0,
      expired: true,
    });
});

void test('road distances show kilometres and miles from the same metre value', () => {
  assert.equal(formatDistance(10000), '10 km · 6.2 mi');
  assert.equal(formatDistance(1609.344), '1.6 km · 1 mi');
  assert.equal(formatDistance(12361), '12.4 km · 7.7 mi');
  assert.equal(formatDistance(0), '0 km · 0 mi');
});

void test('the self-hosted variable font covers Latin and Korean with valid local WOFF2 files', async () => {
  const root = new URL('../public/trip/fonts/', import.meta.url);
  const css = await readFile(new URL('noto-sans-kr.css', root), 'utf8');
  assert.match(css, /font-family: 'Noto Sans KR'/);
  assert.match(css, /font-weight: 100 900/);
  assert.doesNotMatch(css, /https?:\/\//);
  const urls = [...css.matchAll(/url\(([^)]+)\)/g)].map((match) => match[1]);
  assert.ok(urls.length > 1);
  for (const name of urls) {
    assert.match(name, /^noto-sans-kr-[a-z0-9-]+\.woff2$/);
    const font = await readFile(new URL(name, root));
    assert.equal(font.subarray(0, 4).toString(), 'wOF2', name);
    assert.equal(font.readUInt32BE(8), font.length, name);
  }
  const ranges = [...css.matchAll(/unicode-range:\s*([^;]+);/g)].flatMap(
    (match) =>
      match[1].split(',').map((part) => {
        const [start, end = start] = part.trim().slice(2).split('-');
        return [parseInt(start, 16), parseInt(end, 16)];
      }),
  );
  for (const codepoint of [0x41, 0x61, 0x30, 0xac00, 0xd7a3, 0xd55c, 0xae00])
    assert.ok(
      ranges.some(([start, end]) => codepoint >= start && codepoint <= end),
    );
  assert.match(
    await readFile(new URL('OFL-NotoSansKR.txt', root), 'utf8'),
    /SIL OPEN FONT LICENSE Version 1.1/,
  );
});
