import assert from 'node:assert/strict';
import test from 'node:test';
import { createTripInteractionClient } from '../lib/trip-interaction-client.ts';

const settle = async () => {
  for (let i = 0; i < 12; i += 1) await Promise.resolve();
};
function fixture(extra = {}) {
  const requests = [],
    replies = [],
    errors = [];
  const values = new Map();
  const client = createTripInteractionClient({
    userId: 'member-one',
    endpoint: '/ktravel/api/assistant',
    reportEndpoint: '/ktravel/api/reports',
    visible: true,
    voiceEnabled: false,
    storage: {
      getItem: (k) => values.get(k) ?? null,
      setItem: (k, v) => values.set(k, v),
    },
    onReply: (reply) => replies.push(reply),
    onError: (error) => errors.push(error),
    fetch: async (url, options) => {
      requests.push({ url, ...options, payload: JSON.parse(options.body) });
      return Response.json({});
    },
    ...extra,
  });
  return { client, requests, replies, errors, values };
}

await test('only sound-enabled event generation reports thinking and clears it on reply, mute, hide and disposal', async (t) => {
  const thinking = [], pending = [];
  const f = fixture({
    onThinking: (value) => thinking.push(value),
    fetch: async () => new Promise((resolve) => pending.push(resolve)),
  });
  t.after(() => f.client.dispose());
  assert.deepEqual(thinking, []);
  pending.shift()(Response.json({}));
  await settle();
  f.client.setVoiceEnabled(true);
  f.client.record('card_open', 'samwon');
  assert.deepEqual(thinking, [true]);
  pending.shift()(Response.json({}));
  await settle();
  assert.deepEqual(thinking, [true, false]);
  for (const finish of [() => f.client.setVoiceEnabled(false), () => f.client.setVisible(false), () => f.client.dispose()]) {
    f.client.setVoiceEnabled(true);
    f.client.setVisible(true);
    f.client.record('card_open', 'samwon');
    assert.equal(thinking.at(-1), true);
    finish();
    assert.equal(thinking.at(-1), false);
    pending.shift()(Response.json({}));
    await settle();
    assert.equal(thinking.at(-1), false);
  }
});

await test('card opens and selections record signed-in interaction events while sound is off', async (t) => {
  const f = fixture();
  t.after(() => f.client.dispose());
  f.client.record('card_open', 'gyeongbokgung');
  f.client.record('favorite_added', 'samwon');
  await settle();
  assert.equal(f.requests.length, 3);
  assert.deepEqual(
    f.requests
      .filter((r) => r.payload.event !== 'session_tick')
      .map((r) => [
        r.payload.kind,
        r.payload.event,
        r.payload.activityId,
        r.payload.voiceEnabled,
      ]),
    [
      ['event', 'card_open', 'gyeongbokgung', false],
      ['event', 'favorite_added', 'samwon', false],
    ],
  );
  assert.notEqual(f.requests[0].payload.eventId, f.requests[1].payload.eventId);
  assert.equal(
    f.requests[0].payload.sessionId,
    f.requests[1].payload.sessionId,
  );
  f.client.dispose();
});

await test('visible time excludes background time, heartbeat pauses, and pagehide flushes one quiet keepalive tick', async (t) => {
  t.mock.timers.enable({ apis: ['setTimeout'] });
  let now = 0;
  const f = fixture({ now: () => now });
  t.after(() => f.client.dispose());
  await settle();
  now = 60000;
  t.mock.timers.tick(60000);
  await settle();
  assert.equal(f.requests.length, 2);
  assert.equal(f.requests[1].payload.elapsedSeconds, 60);
  f.client.setVisible(false);
  now = 180000;
  t.mock.timers.tick(120000);
  await settle();
  assert.equal(f.requests.length, 2);
  f.client.setVisible(true);
  now = 195000;
  f.client.pagehide();
  await settle();
  assert.equal(f.requests.length, 3);
  assert.equal(f.requests[2].payload.elapsedSeconds, 75);
  assert.equal(f.requests[2].keepalive, true);
  assert.equal(f.requests[2].payload.voiceEnabled, false);
  now = 400000;
  t.mock.timers.tick(205000);
  await settle();
  assert.equal(f.requests.length, 3);
  f.client.dispose();
});

await test('text chat works with voice off and report drafts send only after explicit Ask Shawn', async () => {
  const requests = [],
    replies = [];
  const reply = {
    id: 'stored-message',
    text: 'Ask Shawn about the booking.',
    sources: [
      {
        activityId: 'samwon',
        title: 'Samwon Garden',
        url: 'https://example.com/samwon',
      },
    ],
    reportDraft: 'Could we book Samwon Garden?',
  };
  const f = fixture({
    onReply: (item) => replies.push(item),
    fetch: async (url, options) => {
      requests.push({ url, payload: JSON.parse(options.body) });
      return Response.json(
        url.endsWith('/reports') ? { report: { id: 'report-one' } } : { reply },
      );
    },
  });
  await f.client.chat('  Can ten people visit?  ', 'samwon');
  assert.deepEqual(requests[1].payload, {
    kind: 'chat',
    sessionId: requests[1].payload.sessionId,
    message: 'Can ten people visit?',
    activityId: 'samwon',
  });
  assert.equal(requests.length, 2);
  assert.deepEqual(replies, [reply]);
  await f.client.askShawn(reply.reportDraft);
  assert.deepEqual(requests[2], {
    url: '/ktravel/api/reports',
    payload: { message: 'Could we book Samwon Garden?' },
  });
  await f.client.markHeard(reply.id);
  assert.deepEqual(requests[3].payload, {
    kind: 'heard',
    messageId: 'stored-message',
  });
  f.client.dispose();
});

await test('hidden or disposed requests cannot publish replies and a visible retry retains its deduplicated event ID', async () => {
  let finish;
  const requests = [],
    replies = [];
  const reply = { id: 'late-one', text: 'Late answer.', sources: [] };
  const f = fixture({
    voiceEnabled: true,
    onReply: (item) => replies.push(item),
    fetch: async (_url, options) => {
      requests.push(options);
      return new Promise((resolve) => {
        finish = resolve;
      });
    },
  });
  f.client.record('card_open', 'samwon');
  const first = JSON.parse(requests[0].body);
  f.client.setVisible(false);
  assert.equal(requests[0].signal.aborted, true);
  finish(Response.json({ reply }));
  await settle();
  assert.deepEqual(replies, []);
  f.client.setVisible(true);
  assert.equal(JSON.parse(requests[1].body).eventId, first.eventId);
  f.client.dispose();
  finish(Response.json({ reply }));
  await settle();
  assert.equal(requests[1].signal.aborted, true);
  assert.deepEqual(replies, []);
});

await test('a newly visible session records its start before interactions and restores the same session after hiding', async () => {
  const f = fixture({ visible: false });
  assert.equal(f.requests.length, 0);
  f.client.setVisible(true);
  await settle();
  assert.equal(f.requests[0].payload.event, 'session_tick');
  assert.equal(f.requests[0].payload.elapsedSeconds, 0);
  const sessionId = f.requests[0].payload.sessionId;
  f.client.setVisible(false);
  f.client.setVisible(true);
  await settle();
  f.client.record('card_open', 'samwon');
  await settle();
  assert.ok(
    f.requests.every((request) => request.payload.sessionId === sessionId),
  );
  f.client.dispose();
});

await test('the bounded outbox restores event IDs/session after recreation without creating a second session start', async (t) => {
  const values = new Map(),
    storage = {
      getItem: (k) => values.get(k) ?? null,
      setItem: (k, v) => values.set(k, v),
    };
  const first = fixture({ storage, fetch: async () => new Promise(() => {}) });
  t.after(() => first.client.dispose());
  for (let i = 0; i < 50; i += 1) first.client.record('card_open', 'samwon');
  first.client.dispose();
  const saved = JSON.parse([...values.values()][0]);
  assert.equal(saved.queue.length, 32);
  const requests = [];
  const second = fixture({
    storage,
    fetch: async (_url, options) => {
      requests.push(JSON.parse(options.body));
      return Response.json({});
    },
  });
  t.after(() => second.client.dispose());
  await settle();
  assert.equal(requests[0].sessionId, saved.sessionId);
  assert.equal(requests[0].eventId, saved.queue[0].eventId);
  assert.equal(
    requests.filter((item) => item.event === 'session_tick').length,
    0,
  );
});

await test('requests use finite chat/event deadlines and twenty mount/dispose cycles retain no timer or live request', async (t) => {
  const active = new Set(),
    signals = [];
  const originalSet = setTimeout,
    originalClear = clearTimeout;
  t.mock.method(globalThis, 'setTimeout', (callback, ms) => {
    const token = originalSet(() => {
      active.delete(token);
      callback();
    }, ms);
    active.add(token);
    return token;
  });
  t.mock.method(globalThis, 'clearTimeout', (token) => {
    active.delete(token);
    return originalClear(token);
  });
  for (let i = 0; i < 20; i += 1) {
    const f = fixture({
      fetch: async (_url, options) => {
        signals.push(options.signal);
        return new Promise(() => {});
      },
    });
    assert.equal(active.size, 2);
    f.client.dispose();
    assert.equal(active.size, 0);
  }
  assert.ok(signals.every((signal) => signal.aborted));
});

await test('chat has a twenty-second finite deadline, invalid replies fail visibly, and unauthorized sessions are reported', async (t) => {
  t.mock.timers.enable({ apis: ['setTimeout'] });
  let signal,
    expired = 0;
  const f = fixture({
    onSessionExpired: () => {
      expired += 1;
    },
    fetch: async (_url, options) => {
      if (JSON.parse(options.body).kind === 'event') return Response.json({});
      signal = options.signal;
      return new Promise((_resolve, reject) =>
        signal.addEventListener('abort', () => reject(new Error('Timed out')), {
          once: true,
        }),
      );
    },
  });
  t.after(() => f.client.dispose());
  await settle();
  const pending = assert.rejects(
    f.client.chat('Where should we eat?'),
    /Timed out/,
  );
  t.mock.timers.tick(19999);
  assert.equal(signal.aborted, false);
  t.mock.timers.tick(1);
  await pending;
  assert.equal(signal.aborted, true);
  const invalid = fixture({
    fetch: async () =>
      Response.json({
        reply: {
          id: 'bad',
          text: 'Untrusted',
          sources: [
            {
              activityId: 'samwon',
              title: 'Source',
              url: 'javascript:alert(1)',
            },
          ],
        },
      }),
  });
  t.after(() => invalid.client.dispose());
  await assert.rejects(invalid.client.chat('Source?'), /unreadable reply/);
  const unauthorized = fixture({
    onSessionExpired: () => {
      expired += 1;
    },
    fetch: async () =>
      Response.json({ error: 'Sign in again.' }, { status: 401 }),
  });
  t.after(() => unauthorized.client.dispose());
  await assert.rejects(unauthorized.client.chat('Question?'), /Sign in again/);
  assert.ok(expired >= 1);
});
