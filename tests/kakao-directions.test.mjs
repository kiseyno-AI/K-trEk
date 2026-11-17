import test from 'node:test';
import assert from 'node:assert/strict';
import { createServer } from 'node:http';
import { once } from 'node:events';
import { createKakaoDirectionsHandler } from '../lib/kakao-directions.ts';

const venue = {
  id: 'history-deoksugung',
  published: true,
  coordinate_status: 'verified',
  longitude: 126.9765475,
  latitude: 37.5650259,
};
const request = (signal) =>
  new Request(`https://example.test/ktravel/directions/${venue.id}`, {
    signal,
  });

// Unabridged road coordinates and 85m/19s summary from Kakao's official response example:
// https://developers.kakaomobility.com/guide/navi-api/directions.html
// Replayed through local HTTP, not claimed as a live Seoul Station route.
const fixture = {
  trans_id: 'fixture-only',
  routes: [
    {
      result_code: 0,
      summary: { distance: 85, duration: 19, fare: { taxi: 22200, toll: 0 } },
      sections: [
        {
          roads: [
            {
              vertexes: [
                127.17352998262038, 37.36708073181059, 127.17357513799075,
                37.36708104732421, 127.17372149772216, 37.367118113235804,
              ],
            },
            {
              vertexes: [
                127.17372149772216, 37.367118113235804, 127.1739231164781,
                37.36726369503417, 127.17434992149448, 37.36746491368941,
              ],
            },
          ],
        },
      ],
    },
  ],
};
const transitFixture = {
  status: 'OK',
  routes: [
    {
      properties: {
        type: 'BUS',
        totalTime: 700,
        totalDistance: 2000,
        fare: { value: 1500 },
        transfers: 0,
      },
    },
    {
      properties: {
        type: 'SUBWAY',
        totalTime: 500,
        totalDistance: 1800,
        fare: { value: 1550 },
        transfers: 0,
      },
    },
    {
      properties: {
        type: 'BUS_AND_SUBWAY',
        totalTime: 900,
        totalDistance: 3200,
        fare: { value: 1550 },
        transfers: 1,
      },
    },
    {
      properties: {
        type: 'BUS',
        totalTime: 600,
        totalDistance: 1900,
        transfers: 0,
      },
    },
  ],
};

await test('the fastest transit alternative keeps its ordered walking, bus and subway geometry', async () => {
  const route = (type, seconds, steps) => ({
    properties: { type, totalTime: seconds, totalDistance: 1900, transfers: 1 },
    steps,
  });
  const step = (type, points) => ({ properties: { type }, path: { points } });
  const input = {
    status: 'OK',
    routes: [
      route('BUS_AND_SUBWAY', 900, [
        step('BUS', [
          [126.97, 37.55],
          [126.98, 37.56],
        ]),
      ]),
      route('BUS_AND_SUBWAY', 700, [
        step('BUS', [
          [126.97, 37.55],
          [126.97, 37.55],
          [126.975, 37.553],
        ]),
        step('WALKING', [
          [126.975, 37.553],
          [126.976, 37.554],
        ]),
        step('SUBWAY', [
          [126.976, 37.554],
          [126.99, 37.56],
        ]),
      ]),
    ],
  };
  const handle = createKakaoDirectionsHandler({
    findActivity: async () => venue,
    getApiKey: () => 'server-only-key',
    fetch: async (url) =>
      Response.json(
        new URL(url).hostname === 'dapi.kakao.com' ? input : fixture,
      ),
  });
  const response = await handle(request(), venue.id);
  const body = await response.json();
  assert.equal(response.status, 200);
  assert.equal(body.transitOptions[0].durationSeconds, 700);
  assert.deepEqual(body.transitOptions[0].segments, [
    {
      mode: 'bus',
      path: [
        [126.97, 37.55],
        [126.975, 37.553],
      ],
    },
    {
      mode: 'walk',
      path: [
        [126.975, 37.553],
        [126.976, 37.554],
      ],
    },
    {
      mode: 'subway',
      path: [
        [126.976, 37.554],
        [126.99, 37.56],
      ],
    },
  ]);
});

await test('missing or invalid transit geometry preserves totals without drawing partial or invented legs', async () => {
  const validStep = {
    properties: { type: 'BUS' },
    path: {
      points: [
        [126.97, 37.55],
        [126.98, 37.56],
      ],
    },
  };
  const stepWith = (points) => ({ ...validStep, path: { points } });
  for (const steps of [
    undefined,
    null,
    [],
    [validStep, { ...validStep, properties: { type: 'TAXI' } }],
    [
      validStep,
      stepWith([
        [126.97, 37.55],
        [181, 37.56],
      ]),
    ],
    [
      stepWith([
        [126.97, 37.55],
        [126.98, null],
      ]),
    ],
    [
      stepWith([
        [126.97, 37.55],
        ['126.98', 37.56],
      ]),
    ],
    [
      stepWith([
        [126.97, 37.55],
        [126.97, 37.55],
      ]),
    ],
    [
      stepWith([
        [126.97, 37.55, 0],
        [126.98, 37.56],
      ]),
    ],
    [stepWith([[126.97, 37.55]])],
    [stepWith(Array.from({ length: 50001 }, () => [126.97, 37.55]))],
    Array.from({ length: 257 }, () => validStep),
  ]) {
    const input = structuredClone(transitFixture);
    const fastest = input.routes[0];
    fastest.steps = steps;
    input.routes = [
      {
        ...fastest,
        properties: { ...fastest.properties, totalTime: 900 },
        steps: [validStep],
      },
      fastest,
    ];
    const handle = createKakaoDirectionsHandler({
      findActivity: async () => venue,
      getApiKey: () => 'server-only-key',
      fetch: async (url) =>
        Response.json(
          new URL(url).hostname === 'dapi.kakao.com' ? input : fixture,
        ),
    });
    const body = await (await handle(request(), venue.id)).json();
    assert.equal(body.status, 'ok');
    assert.equal(body.transitStatus, 'ok');
    assert.equal(body.transitOptions[0].durationSeconds, 700);
    assert.deepEqual(body.transitOptions[0].segments, []);
    assert.equal(body.path.length, 5);
  }
});

await test('public directions replay provider road geometry over HTTP without exposing the server key', async (t) => {
  const server = createServer((incoming, outgoing) => {
    assert.equal(incoming.headers.authorization, 'KakaoAK server-only-key');
    outgoing.setHeader('content-type', 'application/json');
    outgoing.end(
      JSON.stringify(
        incoming.url.startsWith('/v2/routing/publictraffic')
          ? transitFixture
          : fixture,
      ),
    );
  });
  server.listen(0, '127.0.0.1');
  await once(server, 'listening');
  t.after(async () => {
    server.closeAllConnections();
    await new Promise((resolve) => server.close(resolve));
  });
  const handle = createKakaoDirectionsHandler({
    findActivity: async () => venue,
    getApiKey: () => 'server-only-key',
    now: () => Date.parse('2026-11-15T12:00:00Z'),
    fetch: async (input, init) => {
      const url = new URL(input);
      if (url.hostname === 'apis-navi.kakaomobility.com') {
        assert.equal(url.pathname, '/v1/directions');
        assert.equal(url.searchParams.get('origin'), '126.9707793,37.5545547');
        assert.equal(
          url.searchParams.get('destination'),
          '126.9765475,37.5650259',
        );
        assert.equal(url.searchParams.get('priority'), 'RECOMMEND');
        assert.equal(url.searchParams.get('summary'), 'false');
        assert.equal(url.searchParams.get('alternatives'), 'false');
      } else {
        assert.equal(
          url.origin + url.pathname,
          'https://dapi.kakao.com/v2/routing/publictraffic',
        );
        assert.equal(url.searchParams.get('input_coord'), 'WGS84');
        assert.equal(url.searchParams.get('output_coord'), 'WGS84');
      }
      if (init.redirect === 'error')
        throw new TypeError(
          'The Workers runtime supports follow or manual redirects',
        );
      return fetch(
        `http://127.0.0.1:${server.address().port}${url.pathname}${url.search}`,
        init,
      );
    },
  });
  const response = await handle(
    new Request(`${request().url}?destination=1,1`),
    venue.id,
  );
  assert.equal(response.status, 200);
  const body = await response.json();
  assert.deepEqual(body, {
    status: 'ok',
    activityId: venue.id,
    origin: {
      name: 'Seoul Station',
      longitude: 126.9707793,
      latitude: 37.5545547,
    },
    provider: 'kakao',
    distanceMeters: 85,
    durationSeconds: 19,
    taxiFareKrw: 22200,
    tollFareKrw: 0,
    transitStatus: 'ok',
    transitMessage: null,
    transitOptions: [
      {
        mode: 'bus',
        durationSeconds: 600,
        distanceMeters: 1900,
        fareKrw: null,
        transfers: 0,
        segments: [],
      },
      {
        mode: 'subway',
        durationSeconds: 500,
        distanceMeters: 1800,
        fareKrw: 1550,
        transfers: 0,
        segments: [],
      },
      {
        mode: 'bus_and_subway',
        durationSeconds: 900,
        distanceMeters: 3200,
        fareKrw: 1550,
        transfers: 1,
        segments: [],
      },
    ],
    fetchedAt: '2026-11-15T12:00:00.000Z',
    path: [
      [127.17352998262038, 37.36708073181059],
      [127.17357513799075, 37.36708104732421],
      [127.17372149772216, 37.367118113235804],
      [127.1739231164781, 37.36726369503417],
      [127.17434992149448, 37.36746491368941],
    ],
  });
  assert.equal(JSON.stringify(body).includes('server-only-key'), false);
});

await test('missing or invalid fares stay null without dropping a valid driving route', async () => {
  for (const [fare, taxi, toll] of [
    [undefined, null, null],
    [null, null, null],
    [{}, null, null],
    [{ taxi: 0, toll: 1200 }, 0, 1200],
    [{ taxi: 22200 }, 22200, null],
    [{ toll: 0 }, null, 0],
    [{ taxi: -1, toll: 1.5 }, null, null],
    [{ taxi: '22200', toll: false }, null, null],
    [{ taxi: Infinity, toll: NaN }, null, null],
    [{ taxi: Number.MAX_SAFE_INTEGER + 1, toll: -Infinity }, null, null],
    ['private diagnostic', null, null],
  ]) {
    const input = structuredClone(fixture);
    input.routes[0].summary.fare = fare;
    const handle = createKakaoDirectionsHandler({
      findActivity: async () => venue,
      getApiKey: () => 'server-only-key',
      fetch: async () => Response.json(input),
    });
    const response = await handle(request(), venue.id);
    assert.equal(response.status, 200);
    const body = await response.json();
    assert.equal(body.taxiFareKrw, taxi);
    assert.equal(body.tollFareKrw, toll);
    assert.equal(body.path.length, 5);
    assert.equal(body.durationSeconds, 19);
  }
});

await test('transit permission failures preserve the valid drive and redact provider diagnostics', async () => {
  let transitCalls = 0;
  const handle = createKakaoDirectionsHandler({
    findActivity: async () => venue,
    getApiKey: () => 'server-only-key',
    fetch: async (input, init) => {
      const url = new URL(input);
      if (url.hostname === 'apis-navi.kakaomobility.com')
        return Response.json(fixture);
      transitCalls += 1;
      assert.equal(
        url.origin + url.pathname,
        'https://dapi.kakao.com/v2/routing/publictraffic',
      );
      assert.equal(url.searchParams.get('start_x'), '126.9707793');
      assert.equal(url.searchParams.get('start_y'), '37.5545547');
      assert.equal(url.searchParams.get('end_x'), '126.9765475');
      assert.equal(url.searchParams.get('end_y'), '37.5650259');
      assert.equal(init.headers.Authorization, 'KakaoAK server-only-key');
      assert.equal(init.redirect, 'manual');
      return new Response('private provider diagnostic server-only-key', {
        status: 403,
      });
    },
  });
  const response = await handle(request(), venue.id);
  const body = await response.json();
  assert.equal(response.status, 200);
  assert.equal(body.status, 'ok');
  assert.equal(body.taxiFareKrw, 22200);
  assert.equal(body.transitStatus, 'unavailable');
  assert.deepEqual(body.transitOptions, []);
  assert.equal(transitCalls, 1);
  assert.doesNotMatch(JSON.stringify(body), /private provider|server-only-key/);
});

await test('transit no-route, quota and provider failures never erase the successful drive', async () => {
  for (const [status, input, expected] of [
    [200, { status: 'NO_RESULTS' }, 'no_route'],
    [200, { status: 'OK', routes: [] }, 'no_route'],
    [
      200,
      {
        status: 'OK',
        routes: [
          { properties: { type: 'BUS', totalTime: -1, totalDistance: 100 } },
        ],
      },
      'upstream_error',
    ],
    [429, { message: 'server-only-key' }, 'rate_limited'],
    [400, { code: -10, message: 'server-only-key' }, 'rate_limited'],
    [503, { message: 'server-only-key' }, 'upstream_error'],
    [302, { message: 'server-only-key' }, 'upstream_error'],
  ]) {
    const handle = createKakaoDirectionsHandler({
      findActivity: async () => venue,
      getApiKey: () => 'server-only-key',
      fetch: async (url, init) => {
        assert.equal(init.redirect, 'manual');
        return new URL(url).hostname === 'dapi.kakao.com'
          ? Response.json(input, {
              status,
              headers: { Location: 'https://attacker.invalid/key' },
            })
          : Response.json(fixture);
      },
    });
    const response = await handle(request(), venue.id),
      body = await response.json();
    assert.equal(response.status, 200);
    assert.equal(body.status, 'ok');
    assert.equal(body.transitStatus, expected);
    assert.deepEqual(body.transitOptions, []);
    assert.equal(body.taxiFareKrw, 22200);
    assert.doesNotMatch(JSON.stringify(body), /server-only-key|attacker/);
  }
});

await test('the shared deadline stops a stalled transit request without discarding a valid drive', async () => {
  let transitSignal;
  const handle = createKakaoDirectionsHandler({
    findActivity: async () => venue,
    getApiKey: () => 'server-only-key',
    timeoutMs: 25,
    fetch: async (url, init) => {
      if (new URL(url).hostname !== 'dapi.kakao.com')
        return Response.json(fixture);
      transitSignal = init.signal;
      return new Promise(() => {});
    },
  });
  const response = await handle(request(), venue.id),
    body = await response.json();
  assert.equal(response.status, 200);
  assert.equal(body.status, 'ok');
  assert.equal(body.transitStatus, 'upstream_error');
  assert.equal(body.path.length, 5);
  assert.equal(transitSignal.aborted, true);
});

await test('a transit response slower than two seconds can finish within the shared eight-second budget', async () => {
  const handle = createKakaoDirectionsHandler({
    findActivity: async () => venue,
    getApiKey: () => 'server-only-key',
    fetch: async (url) => {
      if (new URL(url).hostname !== 'dapi.kakao.com')
        return Response.json(fixture);
      await new Promise((resolve) => setTimeout(resolve, 2150));
      return Response.json(transitFixture);
    },
  });
  const response = await handle(request(), venue.id);
  const body = await response.json();
  assert.equal(response.status, 200);
  assert.equal(body.status, 'ok');
  assert.equal(body.transitStatus, 'ok');
  assert.equal(body.transitOptions.length, 3);
});

await test('invalid transit fare or transfer fields stay unknown on an otherwise valid option', async () => {
  const handle = createKakaoDirectionsHandler({
    findActivity: async () => venue,
    getApiKey: () => 'server-only-key',
    fetch: async (url) =>
      Response.json(
        new URL(url).hostname === 'dapi.kakao.com'
          ? {
              status: 'OK',
              routes: [
                {
                  properties: {
                    type: 'SUBWAY',
                    totalTime: 600,
                    totalDistance: 2100,
                    fare: { value: '1550' },
                    transfers: -1,
                  },
                },
              ],
            }
          : fixture,
      ),
  });
  const body = await (await handle(request(), venue.id)).json();
  assert.equal(body.transitStatus, 'ok');
  assert.deepEqual(body.transitOptions, [
    {
      mode: 'subway',
      durationSeconds: 600,
      distanceMeters: 2100,
      fareKrw: null,
      transfers: null,
      segments: [],
    },
  ]);
});

await test('a provider redirect is rejected without sending the key to its target', async (t) => {
  let redirectedCalls = 0;
  const server = createServer((incoming, outgoing) => {
    if (incoming.url === '/redirect-target') {
      redirectedCalls += 1;
      outgoing.end(JSON.stringify(fixture));
    } else {
      outgoing.writeHead(302, {
        Location: '/redirect-target',
        'Content-Type': 'text/html',
      });
      outgoing.end('Private redirect details');
    }
  });
  server.listen(0, '127.0.0.1');
  await once(server, 'listening');
  t.after(async () => {
    server.closeAllConnections();
    await new Promise((resolve) => server.close(resolve));
  });
  const handle = createKakaoDirectionsHandler({
    findActivity: async () => venue,
    getApiKey: () => 'server-only-key',
    fetch: async (_input, init) =>
      fetch(`http://127.0.0.1:${server.address().port}/route`, init),
  });
  const response = await handle(request(), venue.id);
  assert.equal(response.status, 502);
  assert.equal((await response.json()).status, 'upstream_error');
  assert.equal(response.headers.get('location'), null);
  assert.equal(redirectedCalls, 0);
});

await test('invalid IDs, unpublished records and unverified destinations cannot request paid routes', async () => {
  let databaseReads = 0,
    providerCalls = 0;
  let record = venue;
  const handle = createKakaoDirectionsHandler({
    findActivity: async () => {
      databaseReads += 1;
      return record;
    },
    getApiKey: () => 'server-only-key',
    fetch: async () => {
      providerCalls += 1;
      return Response.json(fixture);
    },
  });
  for (const id of ['../admin', '', 'A-venue', 'a'.repeat(81)]) {
    const response = await handle(request(), id);
    assert.equal(response.status, 404);
    assert.equal((await response.json()).status, 'invalid_destination');
  }
  assert.equal(databaseReads, 0);
  for (const value of [
    null,
    { ...venue, published: false },
    { ...venue, id: 'other' },
  ]) {
    record = value;
    assert.equal((await handle(request(), venue.id)).status, 404);
  }
  for (const value of [
    { ...venue, coordinate_status: 'illustrative' },
    { ...venue, longitude: null },
    { ...venue, latitude: Infinity },
    { ...venue, longitude: 181 },
    { ...venue, latitude: -91 },
  ]) {
    record = value;
    const response = await handle(request(), venue.id);
    assert.equal(response.status, 422);
    assert.equal((await response.json()).status, 'invalid_destination');
  }
  assert.equal(providerCalls, 0);
});

await test('a published destination reports an unconfigured service without requesting a route', async () => {
  let requested = false;
  const handle = createKakaoDirectionsHandler({
    findActivity: async () => venue,
    getApiKey: () => undefined,
    fetch: async () => {
      requested = true;
      throw new Error('Must not request an unconfigured provider');
    },
  });
  const response = await handle(request(), venue.id);
  assert.equal(response.status, 503);
  assert.equal((await response.json()).status, 'missing_key');
  assert.equal(response.headers.get('cache-control'), 'no-store');
  assert.equal(requested, false);
});

await test('provider no-route and quota errors stay distinct and never expose upstream messages', async () => {
  for (const [provider, expectedStatus, httpStatus] of [
    [
      Response.json({
        routes: [{ result_code: 103, result_msg: 'server-only-key' }],
      }),
      'no_route',
      422,
    ],
    [Response.json({ routes: [] }), 'no_route', 422],
    [
      Response.json({ msg: 'server-only-key' }, { status: 429 }),
      'rate_limited',
      429,
    ],
    [
      Response.json({ code: -10, msg: 'server-only-key' }, { status: 400 }),
      'rate_limited',
      429,
    ],
    [
      Response.json({ code: -401, msg: 'server-only-key' }, { status: 401 }),
      'upstream_error',
      502,
    ],
  ]) {
    const handle = createKakaoDirectionsHandler({
      findActivity: async () => venue,
      getApiKey: () => 'server-only-key',
      fetch: async () => provider,
    });
    const response = await handle(request(), venue.id);
    assert.equal(response.status, httpStatus);
    const body = await response.json();
    assert.equal(body.status, expectedStatus);
    assert.equal(JSON.stringify(body).includes('server-only-key'), false);
    assert.equal('path' in body, false);
  }
});

await test('malformed, oversized or invalid provider geometry never becomes a made-up connection', async () => {
  const road = (vertexes) => ({
    routes: [
      {
        result_code: 0,
        summary: { distance: 85, duration: 19 },
        sections: [{ roads: [{ vertexes }] }],
      },
    ],
  });
  for (const value of [
    null,
    {},
    { routes: [{}] },
    { routes: [{ result_code: '0' }] },
    road([127, 37, 127.1]),
    road([127, 37, 181, 37]),
    road([127, 37, 127, null]),
    road([127, 37, 127, 37]),
    road(Array.from({ length: 50001 }, () => [127, 37]).flat()),
    { ...fixture, padding: 'x'.repeat(2097152) },
  ]) {
    const handle = createKakaoDirectionsHandler({
      findActivity: async () => venue,
      getApiKey: () => 'server-only-key',
      fetch: async () => Response.json(value),
    });
    const response = await handle(request(), venue.id);
    assert.equal(response.status, 502);
    assert.equal((await response.json()).status, 'upstream_error');
  }
  const handle = createKakaoDirectionsHandler({
    findActivity: async () => venue,
    getApiKey: () => 'server-only-key',
    fetch: async () => {
      throw new Error('Failure containing server-only-key');
    },
  });
  assert.equal(
    (await (await handle(request(), venue.id)).text()).includes(
      'server-only-key',
    ),
    false,
  );
});

await test('an upstream deadline completes even when the external fetch ignores cancellation', async () => {
  let signal;
  const handle = createKakaoDirectionsHandler({
    findActivity: async () => venue,
    getApiKey: () => 'server-only-key',
    timeoutMs: 15,
    fetch: async (_url, init) => {
      signal = init.signal;
      return new Promise(() => {});
    },
  });
  const response = await handle(request(), venue.id);
  assert.equal(response.status, 504);
  assert.equal((await response.json()).status, 'upstream_error');
  assert.equal(signal.aborted, true);
});

await test('concurrent viewers share an in-flight request and one leaving cannot cancel the other', async () => {
  let providerCalls = 0,
    providerSignal,
    resolveProvider;
  const handle = createKakaoDirectionsHandler({
    findActivity: async () => venue,
    getApiKey: () => 'server-only-key',
    fetch: async (_url, init) => {
      if (new URL(_url).hostname === 'dapi.kakao.com')
        return Response.json(transitFixture);
      providerCalls += 1;
      providerSignal = init.signal;
      return new Promise((resolve) => {
        resolveProvider = resolve;
      });
    },
  });
  const leaving = new AbortController();
  const first = handle(request(leaving.signal), venue.id);
  const second = handle(request(), venue.id);
  await new Promise(setImmediate);
  assert.equal(providerCalls, 1);
  leaving.abort();
  assert.equal((await first).status, 503);
  assert.equal(providerSignal.aborted, false);
  resolveProvider(Response.json(fixture));
  assert.equal((await second).status, 200);
  const third = handle(request(), venue.id);
  await new Promise(setImmediate);
  assert.equal(
    providerCalls,
    2,
    'Only pending requests are shared; no route-result cache',
  );
  resolveProvider(Response.json(fixture));
  assert.equal((await third).status, 200);
});

await test('the last leaving viewer releases its provider request and a new viewer can start again', async () => {
  const signals = [];
  const handle = createKakaoDirectionsHandler({
    findActivity: async () => venue,
    getApiKey: () => 'server-only-key',
    fetch: async (_url, init) => {
      signals.push(init.signal);
      return new Promise(() => {});
    },
  });
  const firstController = new AbortController();
  const first = handle(request(firstController.signal), venue.id);
  await new Promise(setImmediate);
  firstController.abort();
  assert.equal((await first).status, 503);
  assert.equal(signals[0].aborted, true);
  const secondController = new AbortController();
  const second = handle(request(secondController.signal), venue.id);
  await new Promise(setImmediate);
  assert.equal(signals.length, 2);
  secondController.abort();
  assert.equal((await second).status, 503);
  assert.equal(signals[1].aborted, true);
});

await test('public requests have a bounded per-isolate provider budget and recover after its window', async () => {
  let clock = 100000,
    calls = 0;
  const handle = createKakaoDirectionsHandler({
    findActivity: async () => venue,
    getApiKey: () => 'server-only-key',
    now: () => clock,
    fetch: async () => {
      calls += 1;
      return Response.json(fixture);
    },
  });
  for (let i = 0; i < 10; i += 1)
    assert.equal((await handle(request(), venue.id)).status, 200);
  const limited = await handle(request(), venue.id);
  assert.equal(limited.status, 429);
  assert.equal((await limited.json()).status, 'rate_limited');
  assert.equal(limited.headers.get('retry-after'), '60');
  assert.equal(calls, 20);
  clock += 60000;
  assert.equal((await handle(request(), venue.id)).status, 200);
});

await test('at most four different provider routes can remain in flight', async () => {
  const controllers = Array.from({ length: 5 }, () => new AbortController());
  let calls = 0;
  const handle = createKakaoDirectionsHandler({
    findActivity: async (id) => ({ ...venue, id }),
    getApiKey: () => 'server-only-key',
    fetch: async () => {
      calls += 1;
      return new Promise(() => {});
    },
  });
  const running = controllers
    .slice(0, 4)
    .map((controller, i) => handle(request(controller.signal), `venue-${i}`));
  await new Promise(setImmediate);
  const limited = await handle(request(controllers[4].signal), 'venue-4');
  assert.equal(limited.status, 429);
  assert.equal(calls, 4);
  controllers.forEach((controller) => controller.abort());
  assert.deepEqual(
    (await Promise.all(running)).map((response) => response.status),
    [503, 503, 503, 503],
  );
});

await test('driving and transit share the same four-upstream-request concurrency cap', async () => {
  let active = 0,
    peak = 0,
    calls = 0;
  const handle = createKakaoDirectionsHandler({
    findActivity: async (id) => ({ ...venue, id }),
    getApiKey: () => 'server-only-key',
    fetch: async (url) => {
      calls += 1;
      active += 1;
      peak = Math.max(peak, active);
      await new Promise(setImmediate);
      active -= 1;
      return Response.json(
        new URL(url).hostname === 'dapi.kakao.com' ? transitFixture : fixture,
      );
    },
  });
  const responses = await Promise.all(
    Array.from({ length: 4 }, (_, i) => handle(request(), `venue-${i}`)),
  );
  assert.deepEqual(
    responses.map((response) => response.status),
    [200, 200, 200, 200],
  );
  assert.equal(calls, 8);
  assert.equal(peak, 4);
});

await test('exhausting the shared call budget preserves the last valid drive without adding a transit call', async () => {
  let calls = 0;
  const handle = createKakaoDirectionsHandler({
    findActivity: async () => venue,
    getApiKey: () => 'server-only-key',
    fetch: async (url) => {
      calls += 1;
      if (calls === 1) return Response.json({}, { status: 502 });
      return Response.json(
        new URL(url).hostname === 'dapi.kakao.com' ? transitFixture : fixture,
      );
    },
  });
  assert.equal((await handle(request(), venue.id)).status, 502);
  for (let index = 0; index < 9; index += 1)
    assert.equal((await handle(request(), venue.id)).status, 200);
  const last = await handle(request(), venue.id),
    body = await last.json();
  assert.equal(last.status, 200);
  assert.equal(body.status, 'ok');
  assert.equal(body.transitStatus, 'rate_limited');
  assert.equal(calls, 20);
});

await test('leaving during the transit phase cancels that provider without retaining a pending route', async () => {
  let transitSignal, started;
  const transitStarted = new Promise((resolve) => {
    started = resolve;
  });
  const handle = createKakaoDirectionsHandler({
    findActivity: async () => venue,
    getApiKey: () => 'server-only-key',
    fetch: async (url, init) => {
      if (new URL(url).hostname !== 'dapi.kakao.com')
        return Response.json(fixture);
      transitSignal = init.signal;
      started();
      return new Promise(() => {});
    },
  });
  const controller = new AbortController();
  const pending = handle(request(controller.signal), venue.id);
  await transitStarted;
  controller.abort();
  assert.equal((await pending).status, 503);
  assert.equal(transitSignal.aborted, true);
});

await test('a configured departure is used by both providers and returned with the matching route', async () => {
  const origin = {
    name: 'Gangnam meeting point',
    longitude: 127.0276,
    latitude: 37.4979,
  };
  const calls = [];
  const handle = createKakaoDirectionsHandler({
    findActivity: async () => venue,
    getApiKey: () => 'server-only-key',
    getOrigin: () => origin,
    fetch: async (input) => {
      const url = new URL(input);
      calls.push(url);
      return Response.json(
        url.hostname === 'apis-navi.kakaomobility.com'
          ? fixture
          : transitFixture,
      );
    },
  });
  for (const suffix of ['', '?origin=default']) {
    calls.length = 0;
    const response = await handle(
      new Request(request().url + suffix),
      venue.id,
    );
    assert.equal(response.status, 200);
    assert.equal(calls[0].searchParams.get('origin'), '127.0276,37.4979');
    assert.equal(calls[1].searchParams.get('start_x'), '127.0276');
    assert.equal(calls[1].searchParams.get('start_y'), '37.4979');
    assert.deepEqual((await response.json()).origin, origin);
  }
});

await test('a selected station replaces the configured departure for driving and transit', async () => {
  const calls = [];
  const handle = createKakaoDirectionsHandler({
    findActivity: async () => venue,
    getApiKey: () => 'server-only-key',
    getOrigin: () => ({
      name: 'Hotel meeting point',
      longitude: 127.01,
      latitude: 37.5,
    }),
    fetch: async (input) => {
      const url = new URL(input);
      calls.push(url);
      return Response.json(
        url.hostname === 'apis-navi.kakaomobility.com'
          ? fixture
          : transitFixture,
      );
    },
  });
  const response = await handle(
    new Request(`${request().url}?origin=gangnam-station`),
    venue.id,
  );
  assert.equal(response.status, 200);
  assert.equal(calls[0].searchParams.get('origin'), '127.0280014,37.4980863');
  assert.equal(calls[1].searchParams.get('start_x'), '127.0280014');
  assert.equal(calls[1].searchParams.get('start_y'), '37.4980863');
  assert.deepEqual((await response.json()).origin, {
    name: 'Gangnam Station',
    longitude: 127.0280014,
    latitude: 37.4980863,
  });
});

await test('unlisted departures and raw coordinates are rejected without any provider work', async () => {
  let calls = 0;
  const handle = createKakaoDirectionsHandler({
    findActivity: async () => venue,
    getApiKey: () => 'server-only-key',
    fetch: async () => {
      calls += 1;
      return Response.json(fixture);
    },
  });
  for (const origin of ['', '0,0', 'Seoul Station', 'unknown', '__proto__']) {
    const response = await handle(
      new Request(`${request().url}?origin=${encodeURIComponent(origin)}`),
      venue.id,
    );
    assert.equal(response.status, 400);
    assert.deepEqual(await response.json(), {
      status: 'invalid_destination',
      message: 'Choose a listed departure.',
    });
  }
  assert.equal(calls, 0);
});

await test('selected departures isolate pending routes while matching selections share and cancel together', async () => {
  const signals = [];
  const release = [];
  const handle = createKakaoDirectionsHandler({
    findActivity: async () => venue,
    getApiKey: () => 'server-only-key',
    fetch: async (input, init) => {
      if (new URL(input).hostname === 'dapi.kakao.com')
        return Response.json(transitFixture);
      signals.push(init.signal);
      return new Promise((resolve) => release.push(resolve));
    },
  });
  const firstController = new AbortController();
  const sameController = new AbortController();
  const first = handle(
    new Request(`${request().url}?origin=gangnam-station`, {
      signal: firstController.signal,
    }),
    venue.id,
  );
  const same = handle(
    new Request(`${request().url}?origin=gangnam-station`, {
      signal: sameController.signal,
    }),
    venue.id,
  );
  const second = handle(
    new Request(`${request().url}?origin=sinchon-station`),
    venue.id,
  );
  await new Promise(setImmediate);
  assert.equal(signals.length, 2);
  firstController.abort();
  assert.equal((await first).status, 503);
  assert.equal(signals[0].aborted, false);
  sameController.abort();
  assert.equal((await same).status, 503);
  assert.equal(signals[0].aborted, true);
  assert.equal(signals[1].aborted, false);
  release[1](Response.json(fixture));
  assert.equal((await (await second).json()).origin.name, 'Sinchon Station');
  // Even a provider that finishes after its last viewer left cannot become the other departure's route.
  release[0](Response.json(fixture));
});

await test('changing the departure cannot reuse a pending route from a different origin', async () => {
  const firstOrigin = {
    name: 'First hotel',
    longitude: 127.01,
    latitude: 37.5,
  };
  const secondOrigin = {
    name: 'Second hotel',
    longitude: 127.04,
    latitude: 37.51,
  };
  let origin = firstOrigin;
  const release = [];
  const handle = createKakaoDirectionsHandler({
    findActivity: async () => venue,
    getApiKey: () => 'server-only-key',
    getOrigin: () => origin,
    fetch: async (input) => {
      if (new URL(input).hostname === 'apis-navi.kakaomobility.com') {
        await new Promise((resolve) => release.push(resolve));
        return Response.json(fixture);
      }
      return Response.json(transitFixture);
    },
  });
  const first = handle(request(), venue.id);
  await new Promise((resolve) => setImmediate(resolve));
  origin = secondOrigin;
  const second = handle(request(), venue.id);
  await new Promise((resolve) => setImmediate(resolve));
  assert.equal(release.length, 2);
  release.forEach((resolve) => resolve());
  assert.deepEqual((await (await first).json()).origin, firstOrigin);
  assert.deepEqual((await (await second).json()).origin, secondOrigin);
});

await test('invalid departure configuration never calls a routing provider', async () => {
  let called = false;
  const handle = createKakaoDirectionsHandler({
    findActivity: async () => venue,
    getApiKey: () => 'server-only-key',
    getOrigin: () => ({
      name: 'Bad configuration',
      longitude: Infinity,
      latitude: 37,
    }),
    fetch: async () => {
      called = true;
      return Response.json(fixture);
    },
  });
  const response = await handle(request(), venue.id);
  assert.equal(response.status, 502);
  assert.equal(called, false);
  assert.doesNotMatch(
    await response.text(),
    /server-only-key|Bad configuration/,
  );
});
