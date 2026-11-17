import assert from 'node:assert/strict';
import test from 'node:test';
import { readTripSession } from '../lib/trip-session.ts';

void test('a stalled initial session lookup releases the login screen after six seconds', async (t) => {
  t.mock.timers.enable({ apis: ['setTimeout'] });
  let requestSignal;
  t.mock.method(globalThis, 'fetch', (_url, { signal }) => {
    requestSignal = signal;
    return new Promise((_resolve, reject) => {
      signal.addEventListener('abort', () => reject(signal.reason), {
        once: true,
      });
    });
  });
  const pending = readTripSession(new AbortController().signal);
  t.mock.timers.tick(5999);
  assert.equal(requestSignal.aborted, false);
  t.mock.timers.tick(1);
  assert.equal(requestSignal.aborted, true);
  assert.equal(await pending, null);
});

void test('initial lookup preserves a real session, fails closed on errors and honors disposal', async (t) => {
  const user = { id: 'member-id', name: 'Alex', role: 'member' };
  const mock = t.mock.method(globalThis, 'fetch', async () =>
    Response.json({ user }),
  );
  assert.deepEqual(await readTripSession(new AbortController().signal), user);
  mock.mock.mockImplementation(async () =>
    Response.json({ error: 'Unavailable' }, { status: 503 }),
  );
  assert.equal(await readTripSession(new AbortController().signal), null);
  const parent = new AbortController();
  let requestSignal;
  mock.mock.mockImplementation((_url, { signal }) => {
    requestSignal = signal;
    return new Promise((_resolve, reject) =>
      signal.addEventListener('abort', () => reject(signal.reason), {
        once: true,
      }),
    );
  });
  const pending = readTripSession(parent.signal);
  parent.abort();
  assert.equal(await pending, null);
  assert.equal(requestSignal.aborted, true);
});
