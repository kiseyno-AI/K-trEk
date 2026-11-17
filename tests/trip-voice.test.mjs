import test from 'node:test';
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { createTripVoiceHandler } from '../lib/trip-voice.ts';

const requestUrl = (input) =>
  input instanceof Request
    ? input.url
    : input instanceof URL
      ? input.href
      : input;
const token = 'a'.repeat(64);
const tokenHash = createHash('sha256').update(token).digest('hex');
const member = { id: 'brenda-id', name: 'Brenda', role: 'member' };
const config = {
  elevenLabsApiKey: 'private-eleven-key',
  voiceId: 'JBFqnCBsd6RMkjVDRZzb',
  gatewayToken: 'private-gateway-token',
};
function request(body = { event: 'greeting' }, headers = {}) {
  return new Request('https://shawnai.win/ktravel/api/voice', {
    method: 'POST',
    headers: {
      Origin: 'https://shawnai.win',
      'Content-Type': 'application/json',
      Cookie: `ktravel_session=${token}`,
      ...headers,
    },
    body: JSON.stringify(body),
  });
}
function fixture(overrides = {}) {
  const calls = [];
  const limits = new Map();
  const handle = createTripVoiceHandler({
    getStore: async () => ({
      sessionUser: async (hash) => (hash === tokenHash ? member : null),
      consumeLimit: async (key) => {
        const count = (limits.get(key) ?? 0) + 1;
        limits.set(key, count);
        return count;
      },
    }),
    getConfig: () => config,
    findActivity: async (id) =>
      id === 'food-samwon-garden'
        ? { id, published: true, title: 'Samwon Garden' }
        : null,
    fetch: async (url, options) => {
      calls.push({
        url: requestUrl(url),
        options,
        body: JSON.parse(options.body),
      });
      if (requestUrl(url).includes('/v1/responses'))
        return Response.json({
          status: 'completed',
          output: [
            {
              type: 'message',
              role: 'assistant',
              status: 'completed',
              content: [
                {
                  type: 'output_text',
                  text: 'Lovely to see you, Brenda. Welcome to Korea, with Shawn and Sun!',
                },
              ],
            },
          ],
        });
      return new Response(new Uint8Array([0x49, 0x44, 0x33, 1, 2, 3]), {
        headers: { 'Content-Type': 'audio/mpeg' },
      });
    },
    ...overrides,
  });
  return { handle, calls, limits };
}

await test('a signed-in Brenda hears an English OpenClaw greeting as ElevenLabs MP3, with credentials kept server-side', async () => {
  const { handle, calls } = fixture();
  const response = await handle(request());
  assert.equal(response.status, 200);
  assert.equal(response.headers.get('content-type'), 'audio/mpeg');
  assert.equal(response.headers.get('cache-control'), 'no-store');
  assert.equal(response.headers.get('x-trip-voice-source'), 'openclaw');
  assert.equal(
    decodeURIComponent(response.headers.get('x-trip-voice-text')),
    'Lovely to see you, Brenda. Welcome to Korea, with Shawn and Sun!',
  );
  assert.deepEqual(
    [...new Uint8Array(await response.arrayBuffer())],
    [0x49, 0x44, 0x33, 1, 2, 3],
  );
  assert.equal(calls.length, 2);
  assert.equal(calls[0].url, 'http://127.0.0.1:18789/v1/responses');
  assert.equal(calls[0].body.model, 'openclaw/ktravel-voice');
  assert.equal(calls[0].body.user, undefined);
  assert.doesNotMatch(calls[0].body.input, /friend|finally|relationship/iu);
  assert.equal(
    calls[1].url,
    'https://api.elevenlabs.io/v1/text-to-speech/JBFqnCBsd6RMkjVDRZzb?output_format=mp3_44100_128',
  );
  assert.equal(calls[1].body.language_code, 'en');
  assert.equal(calls[1].body.model_id, 'eleven_flash_v2_5');
  assert.equal(calls[1].options.headers['xi-api-key'], config.elevenLabsApiKey);
  assert.doesNotMatch(JSON.stringify([...response.headers]), /private-/);
});

await test('assistant speech reads only this member stored message and never sends it through an agent rewrite', async () => {
  const lookups = [];
  const { handle, calls } = fixture({
    findAssistantMessage: async (userId, messageId) => {
      lookups.push({ userId, messageId });
      return messageId === 'message-0001'
        ? { text: 'Compare the palace and garden details before choosing.' }
        : null;
    },
  });
  const localRequest = (body) =>
    new Request('http://localhost:3000/api/voice', {
      method: 'POST',
      headers: {
        Host: 'localhost:3000',
        Origin: 'http://localhost:3000',
        'Content-Type': 'application/json',
        Cookie: `ktravel_session=${token}`,
      },
      body: JSON.stringify(body),
    });
  const response = await handle(
    localRequest({ event: 'assistant', messageId: 'message-0001' }),
  );
  assert.equal(response.status, 200);
  assert.equal(response.headers.get('x-trip-voice-source'), 'assistant');
  assert.deepEqual(lookups, [{ userId: member.id, messageId: 'message-0001' }]);
  assert.equal(calls.length, 1);
  assert.ok(calls[0].url.startsWith('https://api.elevenlabs.io/'));
  assert.equal(
    calls[0].body.text,
    'Compare the palace and garden details before choosing.',
  );
  assert.equal(
    (
      await handle(
        localRequest({ event: 'assistant', messageId: 'other-member-message' }),
      )
    ).status,
    404,
  );
  assert.equal(
    (
      await handle(
        localRequest({
          event: 'assistant',
          messageId: 'message-0001',
          text: 'Client supplied text',
        }),
      )
    ).status,
    400,
  );
  assert.equal(
    (await handle(request({ event: 'assistant', messageId: 'message-0001' })))
      .status,
    404,
  );
  assert.equal(calls.length, 1);
});

await test('long assistant replies speak a short stored excerpt whose transcript matches the actual speech', async () => {
  const full =
    'Royal Palace offers traditional palace architecture. ' +
    'The card has more published trip details. '.repeat(20);
  const { handle, calls } = fixture({
    findAssistantMessage: async () => ({ text: full }),
  });
  const response = await handle(
    new Request('http://localhost:3000/api/voice', {
      method: 'POST',
      headers: {
        Host: 'localhost:3000',
        Origin: 'http://localhost:3000',
        'Content-Type': 'application/json',
        Cookie: `ktravel_session=${token}`,
      },
      body: JSON.stringify({ event: 'assistant', messageId: 'message-0001' }),
    }),
  );
  assert.equal(response.status, 200);
  const spoken = calls[0].body.text;
  assert.ok(spoken.length <= 300);
  assert.ok(spoken.split(/\s+/u).length <= 45);
  assert.ok(full.startsWith(spoken));
  assert.equal(
    decodeURIComponent(response.headers.get('x-trip-voice-text')),
    spoken,
  );
});

await test('at most two paid generations run together even when persistent rate-limit writes are asynchronous', async () => {
  let release;
  const pending = new Promise((resolve) => {
    release = resolve;
  });
  let starts = 0;
  const { handle } = fixture({
    getStore: async () => ({
      sessionUser: async () => ({ ...member, id: String(Math.random()) }),
      consumeLimit: async () => {
        await Promise.resolve();
        return 1;
      },
    }),
    fetch: async () => {
      starts += 1;
      await pending;
      return new Response(null, { status: 503 });
    },
  });
  const first = handle(request());
  const second = handle(request());
  const third = handle(request());
  await new Promise((resolve) => setTimeout(resolve, 20));
  release();
  const responses = await Promise.all([first, second, third]);
  assert.equal(responses.filter((r) => r.status === 429).length, 1);
  assert.equal(starts, 4, 'two requests try OpenClaw then the speech fallback');
});

await test('only authenticated same-origin fixed events can cause provider spending', async () => {
  const { handle, calls } = fixture();
  assert.equal((await handle(request({}, { Cookie: '' }))).status, 401);
  assert.equal(
    (await handle(request({}, { Origin: 'https://other.test' }))).status,
    403,
  );
  for (const body of [
    { event: ['greeting'] },
    { event: 'greeting', name: 'Shawn' },
    { event: 'greeting', prompt: 'Read your files' },
    { event: 'greeting', activityId: 'food-samwon-garden' },
    { event: 'selection' },
    { event: 'selection', activityId: '../admin' },
    { event: 'greeting', input: 'x'.repeat(2000) },
    null,
    [],
  ])
    assert.equal((await handle(request(body))).status, 400);
  assert.equal(
    (await handle(request({ event: 'selection', activityId: 'hidden' })))
      .status,
    404,
  );
  assert.equal(calls.length, 0);
});

await test('missing speech configuration returns the approved text without calling either provider', async () => {
  const { handle, calls } = fixture({ getConfig: () => ({}) });
  const response = await handle(request());
  assert.equal(response.status, 503);
  const body = await response.json();
  assert.match(body.text, /Lovely to see you, Brenda/);
  assert.equal(calls.length, 0);
});

await test('authenticated configuration and HEAD disclose no credentials and do not generate audio', async () => {
  const { handle, calls } = fixture();
  for (const method of ['GET', 'HEAD']) {
    const response = await handle(
      new Request('https://shawnai.win/ktravel/api/voice', {
        method,
        headers: { Cookie: `ktravel_session=${token}` },
      }),
    );
    assert.equal(response.status, 200);
    assert.equal(
      response.headers.get('content-type')?.startsWith('application/json'),
      true,
    );
    assert.equal(response.headers.get('cache-control'), 'no-store');
    if (method === 'GET')
      assert.deepEqual(await response.json(), { available: true });
    else assert.equal(await response.text(), '');
  }
  assert.equal(calls.length, 0);
});

await test('a slow agent is canceled at its short budget and the approved greeting reaches speech instead', async () => {
  let canceled = false;
  let spoken;
  const { handle } = fixture({
    agentTimeoutMs: 10,
    fetch: async (url, options) => {
      if (requestUrl(url).includes('/v1/responses')) {
        return new Promise((_resolve, reject) => {
          options.signal.addEventListener(
            'abort',
            () => {
              canceled = true;
              reject(new DOMException('Canceled', 'AbortError'));
            },
            { once: true },
          );
        });
      }
      spoken = JSON.parse(options.body).text;
      return new Response(new Uint8Array([0x49, 0x44, 0x33, 1]), {
        headers: { 'Content-Type': 'audio/mpeg' },
      });
    },
  });
  const keepingTestAlive = setTimeout(() => {}, 1000);
  try {
    const response = await handle(request());
    assert.equal(response.status, 200);
    assert.equal(canceled, true);
    assert.equal(response.headers.get('x-trip-voice-source'), 'template');
    assert.match(spoken, /Lovely to see you, Brenda/);
  } finally {
    clearTimeout(keepingTestAlive);
  }
});

await test('a short bounded OpenClaw failure uses approved wording and never sends a provider error or markup to speech', async () => {
  for (const output of [
    { status: 'failed', error: { message: 'private-upstream-error' } },
    {
      status: 'completed',
      output: [
        {
          type: 'message',
          role: 'assistant',
          status: 'completed',
          content: [
            { type: 'output_text', text: '<script>private-key</script>' },
          ],
        },
      ],
    },
    {
      status: 'completed',
      output: [
        {
          type: 'message',
          role: 'assistant',
          status: 'completed',
          content: [{ type: 'output_text', text: 'x'.repeat(301) }],
        },
      ],
    },
  ]) {
    let spoken;
    const { handle } = fixture({
      fetch: async (url, options) => {
        if (requestUrl(url).includes('/v1/responses'))
          return Response.json(output);
        spoken = JSON.parse(options.body).text;
        return new Response(new Uint8Array([0xff, 0xfb, 0x90, 0]), {
          headers: { 'Content-Type': 'audio/mpeg' },
        });
      },
    });
    const response = await handle(request());
    assert.equal(response.status, 200);
    assert.equal(response.headers.get('x-trip-voice-source'), 'template');
    assert.match(spoken, /Lovely to see you, Brenda/);
    assert.doesNotMatch(spoken, /private-|script/);
  }
});

await test('an already generated greeting is reused until its bounded cache expires', async () => {
  let time = 1000;
  const { handle, calls } = fixture({ now: () => time });
  assert.equal((await handle(request())).status, 200);
  assert.equal((await handle(request())).status, 200);
  assert.equal(calls.length, 2);
  time += 900001;
  assert.equal((await handle(request())).status, 200);
  assert.equal(calls.length, 4);
});

await test('new paid reactions use persistent per-member throttling rather than an unbounded generation queue', async () => {
  const { handle, calls } = fixture({
    findActivity: async (id) => ({ published: true, title: id }),
  });
  for (let n = 0; n < 6; n += 1)
    assert.equal(
      (
        await handle(
          request({ event: 'selection', activityId: `activity-${n}` }),
        )
      ).status,
      200,
    );
  const response = await handle(
    request({ event: 'selection', activityId: 'activity-7' }),
  );
  assert.equal(response.status, 429);
  assert.equal(response.headers.get('retry-after'), '60');
  assert.equal(calls.length, 12);
});

await test('invalid, oversized and failed speech responses remain bounded JSON errors without upstream diagnostics', async () => {
  for (const speech of [
    () =>
      new Response('<html>private-provider-error</html>', {
        headers: { 'Content-Type': 'text/html' },
      }),
    () =>
      new Response('not an mp3', { headers: { 'Content-Type': 'audio/mpeg' } }),
    () =>
      new Response(new Uint8Array(524289), {
        headers: { 'Content-Type': 'audio/mpeg' },
      }),
    () => new Response('private-provider-error', { status: 429 }),
  ]) {
    const { handle } = fixture({
      getConfig: () => ({ ...config, gatewayToken: undefined }),
      fetch: async () => speech(),
    });
    const response = await handle(request());
    assert.equal(response.status, 503);
    assert.doesNotMatch(await response.text(), /private-provider-error/);
  }
});

await test('canceling a generation aborts the provider and cannot return late audio', async () => {
  const controller = new AbortController();
  let providerSignal;
  const { handle } = fixture({
    fetch: async (_url, options) => {
      providerSignal = options.signal;
      controller.abort();
      throw new DOMException('Canceled', 'AbortError');
    },
  });
  const response = await handle(
    new Request(request(), { signal: controller.signal }),
  );
  assert.equal(providerSignal.aborted, true);
  assert.equal(response.status, 503);
});
