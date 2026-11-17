import test from 'node:test';
import assert from 'node:assert/strict';
import { localTripVoiceAvailable } from '../lib/trip-voice-scope.ts';

await test('production disables voice and assistant even on loopback or forwarded loopback hosts', (t) => {
  const previous = process.env.NODE_ENV;
  t.after(() => {
    if (previous === undefined) delete process.env.NODE_ENV;
    else process.env.NODE_ENV = previous;
  });
  process.env.NODE_ENV = 'production';
  for (const headers of [
    { host: 'localhost:3000' },
    { host: '127.0.0.1:4330' },
    { host: '[::1]:4330' },
    { host: 'shawnai.win', 'x-forwarded-host': 'localhost:3000' },
  ]) assert.equal(localTripVoiceAvailable(new Headers(headers)), false);
});

await test('voice is available only for explicit loopback hosts, including behind the public proxy', () => {
  for (const host of ['localhost:3000', '127.0.0.1:4330', '[::1]:3000'])
    assert.equal(localTripVoiceAvailable(new Headers({ host })), true);
  for (const host of [
    '',
    'shawnai.win',
    'localhost.example.com',
    '192.168.1.2:3000',
  ])
    assert.equal(localTripVoiceAvailable(new Headers({ host })), false);
  assert.equal(
    localTripVoiceAvailable(
      new Headers({
        host: '127.0.0.1:4330',
        'x-forwarded-host': 'shawnai.win',
      }),
    ),
    false,
  );
});
