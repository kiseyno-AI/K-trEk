import assert from 'node:assert/strict';
import test from 'node:test';
import { readFile } from 'node:fs/promises';
import { parseActivity, toActivity } from '../lib/activities.ts';
import { activityFacts } from '../lib/activity-presentation.ts';

const records = JSON.parse(
  await readFile(
    new URL('../data/activities-70.json', import.meta.url),
    'utf8',
  ),
);
const record = records.find((value) => value.id === 'food-samwon-garden');
const card = (changes = {}) =>
  toActivity(parseActivity({ ...record, ...changes }));

void test('restaurant details omit suggested stay without changing the saved planning allowance', () => {
  const activity = card();
  const facts = activityFacts(activity);
  assert.equal(
    facts.some(([label]) => label === 'Suggested stay'),
    false,
  );
  assert.equal(
    facts.some(([label]) => label === 'Duration notes'),
    false,
  );
  assert.equal(activity.details.planned_duration_minutes, 90);
  assert.equal(activity.details.planned_duration_label, '90–120 min');
});

void test('identical booking and group instructions appear once despite whitespace differences', () => {
  const activity = card({
    booking_notes: 'Reserve by phone. Confirm a room for 10.',
    group_reservation: '  Reserve by phone.\n\tConfirm a room for 10.  ',
  });
  const facts = activityFacts(activity);
  assert.deepEqual(
    facts.filter(([label]) => ['Booking', 'Group reservation'].includes(label)),
    [['Booking', 'Reserve by phone. Confirm a room for 10.']],
  );
});

void test('distinct group conditions and group-only instructions stay visible', () => {
  const distinct = activityFacts(
    card({
      booking_notes: 'Book by phone.',
      group_reservation: 'A private room requires 10 people.',
    }),
  );
  assert.deepEqual(
    distinct.filter(([label]) =>
      ['Booking', 'Group reservation'].includes(label),
    ),
    [
      ['Booking', 'Book by phone.'],
      ['Group reservation', 'A private room requires 10 people.'],
    ],
  );
  const groupOnly = activityFacts(
    card({ booking_notes: null, group_reservation: 'Call for a group.' }),
  );
  assert.ok(
    groupOnly.some(
      ([label, value]) =>
        label === 'Group reservation' && value === 'Call for a group.',
    ),
  );
});

void test('non-food planning stays visible and confirmed restaurant programs retain their duration', () => {
  const park = toActivity(
    parseActivity(records.find((value) => value.id === 'nature-seoul-forest')),
  );
  const parkFacts = activityFacts(park);
  assert.ok(
    parkFacts.some(
      ([label, value]) => label === 'Suggested stay' && value === '60–120 min',
    ),
  );
  assert.ok(
    parkFacts.some(
      ([label, value]) =>
        label === 'Duration notes' && value === park.details.duration_notes,
    ),
  );
  const confirmed = activityFacts(card({ operator_duration_minutes: 120 }));
  assert.ok(
    confirmed.some(
      ([label, value]) =>
        label === 'Program duration' && value === '120 minutes',
    ),
  );
  assert.equal(
    confirmed.some(
      ([label]) => label === 'Suggested stay' || label === 'Duration notes',
    ),
    false,
  );
});

void test('all supplied restaurant planning facts are hidden without mutating source records', () => {
  const restaurants = records.filter((value) => value.category_id === 'food');
  assert.equal(restaurants.length, 10);
  const before = structuredClone(restaurants);
  for (const restaurant of restaurants) {
    const facts = activityFacts(toActivity(parseActivity(restaurant)));
    assert.equal(
      facts.some(
        ([label]) => label === 'Suggested stay' || label === 'Duration notes',
      ),
      false,
      restaurant.id,
    );
  }
  assert.deepEqual(restaurants, before);
});
