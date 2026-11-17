import assert from 'node:assert/strict';
import test from 'node:test';
import {
  communityRequest,
  createMemberPreferenceSync,
} from '../lib/trip-community-client.ts';

const settle = () => new Promise((resolve) => setImmediate(resolve));

void test('stored votes restore before any write and do not seed over existing member choices', async (t) => {
  const requests = [];
  const restored = [];
  t.mock.method(globalThis, 'fetch', async (url, init) => {
    requests.push({ url, ...init });
    return Response.json({
      preferences: {
        categoryIds: ['food'],
        draftVoteIds: ['server-choice'],
        submittedVoteIds: [],
        updatedAt: 1,
      },
    });
  });
  const sync = createMemberPreferenceSync({
    initialVotes: { draftVoteIds: ['old-device-choice'], submittedVoteIds: [] },
    onRestore: (value) => restored.push(value),
    onError: () => {},
  });
  await settle();
  assert.deepEqual(restored, [
    { draftVoteIds: ['server-choice'], submittedVoteIds: [] },
  ]);
  assert.equal(requests.length, 1);
  assert.equal(requests[0].method, 'GET');
  sync.dispose();
});

void test('requests have an eight-second deadline and preserve explicit unauthorized responses', async (t) => {
  t.mock.timers.enable({ apis: ['setTimeout'] });
  let requestSignal;
  const mock = t.mock.method(globalThis, 'fetch', (_url, { signal }) => {
    requestSignal = signal;
    return new Promise((_resolve, reject) =>
      signal.addEventListener('abort', () => reject(signal.reason), {
        once: true,
      }),
    );
  });
  const request = communityRequest(
    '/api/reports',
    new AbortController().signal,
  );
  t.mock.timers.tick(7999);
  assert.equal(requestSignal.aborted, false);
  t.mock.timers.tick(1);
  await assert.rejects(request, /timed out/i);
  mock.mock.mockImplementation(async () =>
    Response.json({ error: 'Sign in again.' }, { status: 401 }),
  );
  await assert.rejects(
    communityRequest('/api/reports', new AbortController().signal),
    (error) => error.status === 401 && error.message === 'Sign in again.',
  );
});

void test('a failed initial read never overwrites stored preferences and retries only after another explicit action', async (t) => {
  t.mock.timers.enable({ apis: ['setTimeout'] });
  const methods = [],
    errors = [],
    restored = [];
  let failed = true;
  t.mock.method(globalThis, 'fetch', async (_url, init) => {
    methods.push(init.method);
    if (init.method === 'GET') {
      if (failed)
        return Response.json(
          { error: 'Temporarily unavailable.' },
          { status: 503 },
        );
      return Response.json({
        preferences: {
          categoryIds: [],
          draftVoteIds: ['server'],
          submittedVoteIds: [],
          updatedAt: 1,
        },
      });
    }
    return Response.json({
      preferences: { ...JSON.parse(init.body), updatedAt: 2 },
    });
  });
  const sync = createMemberPreferenceSync({
    initialVotes: { draftVoteIds: ['device'], submittedVoteIds: [] },
    onRestore: (v) => restored.push(v),
    onError: (v) => errors.push(v),
  });
  await settle();
  t.mock.timers.tick(1000);
  await settle();
  assert.deepEqual(methods, ['GET']);
  assert.match(errors.at(-1), /unavailable/);
  failed = false;
  sync.recordCategory('food');
  await settle();
  assert.deepEqual(restored, [
    { draftVoteIds: ['server'], submittedVoteIds: [] },
  ]);
  t.mock.timers.tick(300);
  await settle();
  assert.deepEqual(methods, ['GET', 'GET', 'PUT']);
  sync.dispose();
});

void test('unauthorized or malformed preference reads cannot restore or write another identity data', async (t) => {
  t.mock.timers.enable({ apis: ['setTimeout'] });
  const requests = [],
    errors = [],
    restored = [];
  let expired = 0;
  const mock = t.mock.method(globalThis, 'fetch', async (_url, init) => {
    requests.push(init.method);
    return Response.json({ error: 'Sign in again.' }, { status: 401 });
  });
  const first = createMemberPreferenceSync({
    initialVotes: { draftVoteIds: [], submittedVoteIds: [] },
    onRestore: (v) => restored.push(v),
    onError: (v) => errors.push(v),
    onSessionExpired: () => expired++,
  });
  await settle();
  first.dispose();
  assert.equal(expired, 1);
  assert.deepEqual(requests, ['GET']);
  mock.mock.mockImplementation(async (_url, init) => {
    requests.push(init.method);
    return Response.json({
      preferences: {
        categoryIds: 'bad',
        draftVoteIds: [],
        submittedVoteIds: [],
        updatedAt: 1,
      },
    });
  });
  const second = createMemberPreferenceSync({
    initialVotes: { draftVoteIds: [], submittedVoteIds: [] },
    onRestore: (v) => restored.push(v),
    onError: (v) => errors.push(v),
  });
  await settle();
  t.mock.timers.tick(1000);
  await settle();
  second.dispose();
  assert.deepEqual(restored, []);
  assert.deepEqual(requests, ['GET', 'GET']);
  assert.match(errors.at(-1), /could not be read/i);
});

void test('preference writes are serialized and only the latest queued choices survive a pending save', async (t) => {
  t.mock.timers.enable({ apis: ['setTimeout'] });
  const writes = [];
  let finishFirst;
  t.mock.method(globalThis, 'fetch', async (_url, init) => {
    if (init.method === 'GET')
      return Response.json({
        preferences: {
          categoryIds: [],
          draftVoteIds: [],
          submittedVoteIds: [],
          updatedAt: null,
        },
      });
    const value = JSON.parse(init.body);
    writes.push(value);
    if (writes.length === 1)
      return new Promise((resolve) => {
        finishFirst = () =>
          resolve(Response.json({ preferences: { ...value, updatedAt: 1 } }));
      });
    return Response.json({ preferences: { ...value, updatedAt: 2 } });
  });
  const sync = createMemberPreferenceSync({
    initialVotes: { draftVoteIds: [], submittedVoteIds: [] },
    onRestore: () => {},
    onError: () => {},
  });
  await settle();
  sync.updateVotes(['one'], []);
  t.mock.timers.tick(300);
  assert.equal(writes.length, 1);
  sync.updateVotes(['two'], []);
  sync.updateVotes(['three'], ['three']);
  t.mock.timers.tick(300);
  assert.equal(writes.length, 1);
  finishFirst();
  await settle();
  t.mock.timers.tick(300);
  await settle();
  assert.deepEqual(
    writes.map((value) => value.draftVoteIds),
    [['one'], ['three']],
  );
  assert.deepEqual(writes[1].submittedVoteIds, ['three']);
  sync.dispose();
});

void test('explicit flush persists the last queued choice before sign-out disposal', async (t) => {
  t.mock.timers.enable({ apis: ['setTimeout'] });
  const writes = [];
  t.mock.method(globalThis, 'fetch', async (_url, init) => {
    if (init.method === 'GET')
      return Response.json({
        preferences: {
          categoryIds: [],
          draftVoteIds: [],
          submittedVoteIds: [],
          updatedAt: null,
        },
      });
    const preferences = JSON.parse(init.body);
    writes.push(preferences);
    return Response.json({ preferences: { ...preferences, updatedAt: 1 } });
  });
  const sync = createMemberPreferenceSync({
    initialVotes: { draftVoteIds: [], submittedVoteIds: [] },
    onRestore: () => {},
    onError: () => {},
  });
  await settle();
  sync.updateVotes(['last-choice'], []);
  assert.equal(writes.length, 0);
  await sync.flush();
  sync.dispose();
  t.mock.timers.tick(1000);
  await settle();
  assert.deepEqual(
    writes.map((value) => value.draftVoteIds),
    [['last-choice']],
  );
});

void test('flush waits for a real pending save even after another debounce expires', async (t) => {
  t.mock.timers.enable({ apis: ['setTimeout'] });
  let finish;
  const writes = [];
  t.mock.method(globalThis, 'fetch', async (_url, init) => {
    if (init.method === 'GET')
      return Response.json({
        preferences: {
          categoryIds: [],
          draftVoteIds: [],
          submittedVoteIds: [],
          updatedAt: null,
        },
      });
    const preferences = JSON.parse(init.body);
    writes.push(preferences);
    if (writes.length === 1)
      return new Promise((resolve) => {
        finish = () =>
          resolve(
            Response.json({ preferences: { ...preferences, updatedAt: 1 } }),
          );
      });
    return Response.json({ preferences: { ...preferences, updatedAt: 2 } });
  });
  const sync = createMemberPreferenceSync({
    initialVotes: { draftVoteIds: [], submittedVoteIds: [] },
    onRestore: () => {},
    onError: () => {},
  });
  await settle();
  sync.updateVotes(['first'], []);
  t.mock.timers.tick(300);
  sync.updateVotes(['last'], []);
  t.mock.timers.tick(300);
  let drained = false;
  const flush = sync.flush().then(() => {
    drained = true;
  });
  await settle();
  assert.equal(drained, false);
  finish();
  await flush;
  assert.deepEqual(
    writes.map((value) => value.draftVoteIds),
    [['first'], ['last']],
  );
  sync.dispose();
});

void test('sign-out flush waits for a retrying preference read and persists choices made after the initial failure', async (t) => {
  t.mock.timers.enable({ apis: ['setTimeout'] });
  let reads = 0;
  let finishRead;
  const writes = [];
  t.mock.method(globalThis, 'fetch', async (_url, init) => {
    if (init.method === 'GET') {
      if (++reads === 1)
        return Response.json({ error: 'Temporary failure.' }, { status: 503 });
      return new Promise((resolve) => {
        finishRead = () =>
          resolve(
            Response.json({
              preferences: {
                categoryIds: ['culture'],
                draftVoteIds: ['server-choice'],
                submittedVoteIds: [],
                updatedAt: 1,
              },
            }),
          );
      });
    }
    const preferences = JSON.parse(init.body);
    writes.push(preferences);
    return Response.json({ preferences: { ...preferences, updatedAt: 2 } });
  });
  const sync = createMemberPreferenceSync({
    initialVotes: { draftVoteIds: [], submittedVoteIds: [] },
    onRestore: () => {},
    onError: () => {},
  });
  t.after(() => sync.dispose());
  await settle();
  sync.recordCategory('food');
  sync.recordCategory('nature');
  let drained = false;
  const flush = sync.flush().then(() => {
    drained = true;
  });
  await settle();
  assert.equal(drained, false);
  assert.equal(reads, 2);
  finishRead();
  await flush;
  assert.deepEqual(writes, [
    {
      categoryIds: ['culture', 'food', 'nature'],
      draftVoteIds: ['server-choice'],
      submittedVoteIds: [],
    },
  ]);
});

void test('choices made during initial read are preserved, categories deduplicate, and disposal cancels queued writes', async (t) => {
  t.mock.timers.enable({ apis: ['setTimeout'] });
  let finishRead;
  const writes = [],
    restored = [];
  t.mock.method(globalThis, 'fetch', (_url, init) => {
    if (init.method === 'GET')
      return new Promise((resolve) => {
        finishRead = () =>
          resolve(
            Response.json({
              preferences: {
                categoryIds: ['culture'],
                draftVoteIds: ['server'],
                submittedVoteIds: [],
                updatedAt: 1,
              },
            }),
          );
      });
    const value = JSON.parse(init.body);
    writes.push(value);
    return Promise.resolve(
      Response.json({ preferences: { ...value, updatedAt: 2 } }),
    );
  });
  const sync = createMemberPreferenceSync({
    initialVotes: { draftVoteIds: ['device'], submittedVoteIds: [] },
    onRestore: (value) => restored.push(value),
    onError: () => {},
  });
  sync.recordCategory('food');
  sync.recordCategory('food');
  sync.recordCategory('all');
  sync.updateVotes(['fresh'], []);
  finishRead();
  await settle();
  assert.deepEqual(restored, []);
  t.mock.timers.tick(300);
  await settle();
  assert.deepEqual(writes[0], {
    categoryIds: ['culture', 'food'],
    draftVoteIds: ['fresh'],
    submittedVoteIds: [],
  });
  sync.recordCategory('nature');
  sync.dispose();
  t.mock.timers.tick(1000);
  await settle();
  assert.equal(writes.length, 1);
});
