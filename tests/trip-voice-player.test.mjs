import assert from 'node:assert/strict';
import test from 'node:test';
import { createTripVoicePlayer } from '../lib/trip-voice-player.ts';

function fixture(send, options = {}) {
  const states = [];
  const created = [];
  const revoked = [];
  const urls = [];
  const requests = [];
  const listeners = new Set();
  const audio = new EventTarget();
  const add = audio.addEventListener.bind(audio);
  const remove = audio.removeEventListener.bind(audio);
  audio.addEventListener = (type, listener) => {
    listeners.add(listener);
    add(type, listener);
  };
  audio.removeEventListener = (type, listener) => {
    listeners.delete(listener);
    remove(type, listener);
  };
  Object.assign(audio, {
    src: '',
    preload: '',
    paused: true,
    plays: 0,
    play: async () => {
      audio.paused = false;
      audio.plays += 1;
    },
    pause: () => {
      audio.paused = true;
    },
    load: () => {},
    removeAttribute: () => {
      audio.src = '';
    },
  });
  const player = createTripVoicePlayer({
    endpoint: '/ktravel/api/voice',
    selectionEndpoint: '/ktravel/trip/voice/excellent-choice.mp3',
    selectionText:
      "Excellent choice! You've got a good eye. This trip is getting better already.",
    onState: (state) => states.push(state),
    fetch: async (url, options) => {
      requests.push({ url, ...options });
      return send(url, options);
    },
    createAudio: () => {
      created.push(audio);
      return audio;
    },
    createObjectURL: () => {
      const url = `blob:voice-${urls.length + 1}`;
      urls.push(url);
      return url;
    },
    revokeObjectURL: (url) => revoked.push(url),
    ...options,
  });
  return { player, audio, states, created, revoked, requests, listeners, urls };
}

const speech = () =>
  new Response(new Uint8Array([0xff, 0xfb, 0x90, 0]), {
    headers: {
      'Content-Type': 'audio/mpeg',
      'X-Trip-Voice-Text': encodeURIComponent('Welcome, Brenda!'),
    },
  });

await test('sound is opt-in and muting a pending welcome prevents late audio from playing', async () => {
  let finish;
  const f = fixture(() => new Promise((resolve) => (finish = resolve)));
  await f.player.speak({ event: 'greeting' });
  assert.equal(f.requests.length, 0);
  assert.equal(f.created.length, 0);
  f.player.setEnabled(true);
  const pending = f.player.speak({ event: 'greeting' });
  assert.deepEqual(JSON.parse(f.requests[0].body), { event: 'greeting' });
  f.player.setEnabled(false);
  assert.equal(f.requests[0].signal.aborted, true);
  finish(speech());
  await pending;
  assert.equal(f.audio.plays, 0);
  assert.equal(f.created.length, 0);
  assert.equal(f.states.at(-1).phase, 'off');
  f.player.dispose();
});

await test('short reactions respect a twelve-second gap and repeated playback releases every media source', async () => {
  let now = 0;
  const f = fixture(speech, { now: () => now });
  f.player.setEnabled(true);
  await f.player.speak({ event: 'selection', activityId: 'seoul' });
  await f.player.speak({ event: 'selection', activityId: 'busan' });
  assert.equal(f.requests.length, 1);
  f.audio.ended = true;
  f.audio.dispatchEvent(new Event('ended'));
  assert.equal(f.audio.src, '');
  assert.equal(f.revoked.length, 1);
  for (let i = 0; i < 20; i += 1) {
    now += 12000;
    f.audio.ended = false;
    await f.player.speak({ event: 'selection', activityId: 'busan' });
    f.player.stop();
  }
  assert.equal(f.requests.length, 1);
  assert.equal(f.created.length, 1);
  assert.equal(f.revoked.length, 21);
  assert.deepEqual(f.revoked, f.urls);
  assert.equal(f.audio.src, '');
  f.player.dispose();
  assert.equal(f.listeners.size, 0);
  const count = f.states.length;
  f.audio.dispatchEvent(new Event('ended'));
  await f.player.speak({ event: 'greeting' });
  assert.equal(f.states.length, count);
});

await test('a browser autoplay rejection offers an explicit replay without another paid generation', async () => {
  let now = 1000;
  const f = fixture(speech, { now: () => now });
  f.audio.play = async () => {
    throw new DOMException('A user gesture is required', 'NotAllowedError');
  };
  f.player.setEnabled(true);
  await f.player.speak({ event: 'greeting' });
  assert.equal(f.states.at(-1).phase, 'blocked');
  assert.equal(f.states.at(-1).text, 'Welcome, Brenda!');
  now = 5000;
  f.audio.play = async () => {
    now += 7;
    f.audio.paused = false;
  };
  await f.player.replay();
  assert.equal(f.states.at(-1).phase, 'playing');
  assert.equal(f.states.at(-1).latencyMs, 7);
  assert.equal(f.audio.paused, false);
  assert.equal(f.requests.length, 1);
  f.player.stop();
  assert.equal(f.audio.paused, true);
  assert.equal(f.audio.src, '');
  assert.equal(f.revoked.length, 1);
  f.player.dispose();
});

await test('selection audio uses a prompt-free static GET, starts cached replay immediately and clears the cache when muted', async () => {
  let now = 0;
  const f = fixture(speech, { now: () => now });
  f.player.setEnabled(true);
  await f.player.speak({ event: 'selection', activityId: 'seoul' });
  assert.equal(f.requests[0].url, '/ktravel/trip/voice/excellent-choice.mp3');
  assert.equal(f.requests[0].method, 'GET');
  assert.equal(f.requests[0].body, undefined);
  assert.equal(f.requests[0].headers, undefined);
  assert.equal(
    f.states.at(-1).text,
    "Excellent choice! You've got a good eye. This trip is getting better already.",
  );
  f.player.stop();
  now = 12000;
  const replay = f.player.speak({ event: 'selection', activityId: 'busan' });
  assert.equal(f.audio.plays, 2);
  await replay;
  assert.equal(f.requests.length, 1);
  f.player.setEnabled(false);
  f.player.setEnabled(true);
  now = 24000;
  await f.player.speak({ event: 'selection', activityId: 'jeju' });
  assert.equal(f.requests.length, 2);
  f.player.dispose();
  assert.equal(f.revoked.length, 3);
});

await test('a selection arriving after mute is discarded and cannot refill the playback cache', async () => {
  let now = 0;
  let finish;
  let calls = 0;
  const f = fixture(
    () =>
      ++calls === 1 ? new Promise((resolve) => (finish = resolve)) : speech(),
    { now: () => now },
  );
  f.player.setEnabled(true);
  const pending = f.player.speak({ event: 'selection', activityId: 'seoul' });
  f.player.setEnabled(false);
  f.player.setEnabled(true);
  finish(speech());
  await pending;
  assert.equal(f.requests[0].signal.aborted, true);
  assert.equal(f.audio.plays, 0);
  now = 12000;
  await f.player.speak({ event: 'selection', activityId: 'busan' });
  assert.equal(f.requests.length, 2);
  assert.equal(f.audio.plays, 1);
  f.player.dispose();
});

await test('playback latency measures accepted speech through native play resolution and resets for cached playback and mute', async () => {
  let now = 1000;
  const f = fixture(
    () => {
      now += 20;
      return speech();
    },
    { now: () => now },
  );
  f.audio.play = async () => {
    now += 5;
  };
  f.player.setEnabled(true);
  await f.player.speak({ event: 'selection', activityId: 'seoul' });
  assert.equal(f.states.at(-1).latencyMs, 25);
  f.player.stop();
  assert.equal(f.states.at(-1).latencyMs, undefined);
  now = 14000;
  await f.player.speak({ event: 'selection', activityId: 'busan' });
  assert.equal(f.states.at(-1).latencyMs, 5);
  assert.equal(Number.isFinite(f.states.at(-1).latencyMs), true);
  now = 27000;
  f.audio.play = async () => {
    now -= 5;
  };
  await f.player.speak({ event: 'selection', activityId: 'jeju' });
  assert.equal(f.states.at(-1).latencyMs, 0);
  f.player.setEnabled(false);
  assert.equal(f.states.at(-1).latencyMs, undefined);
  f.player.dispose();
});

await test('heard speech is account-scoped and stays suppressed across toggles and player recreation', async () => {
  const entries = new Map();
  const storage = {
    getItem: (key) => entries.get(key) ?? null,
    setItem: (key, value) => entries.set(key, value),
  };
  const f = fixture(speech, { storage });
  f.player.setIdentity('member-one');
  f.player.setEnabled(true);
  await f.player.speak({ event: 'greeting' });
  f.player.setEnabled(false);
  f.player.setEnabled(true);
  await f.player.speak({ event: 'greeting' });
  assert.equal(f.audio.plays, 1);
  assert.equal(f.requests.length, 1);
  f.player.dispose();
  const reloaded = fixture(speech, { storage });
  reloaded.player.setIdentity('member-one');
  reloaded.player.setEnabled(true);
  await reloaded.player.speak({ event: 'greeting' });
  assert.equal(reloaded.requests.length, 0);
  reloaded.player.setIdentity('member-two');
  await reloaded.player.speak({ event: 'greeting' });
  assert.equal(reloaded.audio.plays, 1);
  reloaded.player.dispose();
});

await test('blocked speech is not recorded as heard, and assistant TTS posts only the stored message ID', async () => {
  const heard = [];
  const f = fixture(speech, { onHeard: (id) => heard.push(id) });
  f.player.setIdentity('member-one');
  f.player.setEnabled(true);
  f.audio.play = async () => {
    throw new DOMException('Gesture needed', 'NotAllowedError');
  };
  await f.player.speak({
    event: 'assistant',
    messageId: 'message-one',
    text: 'A lovely Korea visit.',
  });
  assert.deepEqual(JSON.parse(f.requests[0].body), {
    event: 'assistant',
    messageId: 'message-one',
  });
  assert.deepEqual(heard, []);
  f.audio.play = async () => {
    f.audio.plays += 1;
  };
  await f.player.replay();
  assert.deepEqual(heard, ['message-one']);
  await f.player.speak({
    event: 'assistant',
    messageId: 'message-two',
    text: 'A lovely Korea visit!',
  });
  assert.equal(f.requests.length, 1);
  f.player.dispose();
});

await test('the excellent-choice line plays once per account across different cards and assistant IDs deduplicate normalized text', async () => {
  let now = 0;
  const f = fixture(speech, { now: () => now });
  f.player.setIdentity('member-one');
  f.player.setEnabled(true);
  await f.player.speak({ event: 'selection', activityId: 'samwon' });
  f.player.stop();
  now = 13000;
  await f.player.speak({ event: 'selection', activityId: 'balwoo' });
  f.player.setEnabled(false);
  f.player.setEnabled(true);
  now = 26000;
  await f.player.speak({ event: 'selection', activityId: 'busan' });
  assert.equal(f.requests.length, 1);
  assert.equal(f.audio.plays, 1);
  await f.player.speak({
    event: 'assistant',
    messageId: 'message-one',
    text: 'Visit Seoul, then Busan.',
  });
  await f.player.speak({
    event: 'assistant',
    messageId: 'message-two',
    text: '  VISIT Seoul — then Busan! ',
  });
  assert.equal(f.requests.length, 2);
  assert.equal(f.audio.plays, 2);
  f.player.dispose();
});

await test('short assistant audio shows its actual server transcript and records both the full reply and spoken excerpt only after play', async () => {
  const heard = [],
    entries = new Map();
  const excerpt = 'Seoul has plenty to explore.';
  const f = fixture(
    () =>
      new Response(new Uint8Array([1, 2, 3]), {
        headers: {
          'content-type': 'audio/mpeg',
          'x-trip-voice-text': encodeURIComponent(excerpt),
        },
      }),
    {
      storage: {
        getItem: (key) => entries.get(key) ?? null,
        setItem: (key, value) => entries.set(key, value),
      },
      onHeard: (id) => heard.push(id),
    },
  );
  f.player.setIdentity('member-one');
  f.player.setEnabled(true);
  const full =
    'Seoul has plenty to explore. Compare a palace visit with a Korean barbecue dinner, and keep the rest of your afternoon flexible.';
  await f.player.speak({
    event: 'assistant',
    messageId: 'message-one',
    text: full,
  });
  assert.equal(f.states.at(-1).text, excerpt);
  assert.deepEqual(heard, ['message-one']);
  await f.player.speak({
    event: 'assistant',
    messageId: 'message-two',
    text: full,
  });
  await f.player.speak({
    event: 'assistant',
    messageId: 'message-three',
    text: excerpt,
  });
  assert.equal(f.requests.length, 1);
  const saved = JSON.parse([...entries.values()][0]);
  assert.equal(saved.texts.length, 2);
  f.player.dispose();
});

await test('two already-open account players refresh heard speech before a later tab toggle', async (t) => {
  const entries = new Map(),
    storage = {
      getItem: (key) => entries.get(key) ?? null,
      setItem: (key, value) => entries.set(key, value),
    };
  const first = fixture(speech, { storage }),
    second = fixture(speech, { storage });
  t.after(() => {
    first.player.dispose();
    second.player.dispose();
  });
  first.player.setIdentity('member-one');
  second.player.setIdentity('member-one');
  first.player.setEnabled(true);
  second.player.setEnabled(true);
  await first.player.speak({ event: 'greeting' });
  second.player.setEnabled(false);
  second.player.setEnabled(true);
  await second.player.speak({ event: 'greeting' });
  assert.equal(first.audio.plays, 1);
  assert.equal(second.requests.length, 0);
  assert.equal(second.audio.plays, 0);
});

await test('two account tabs merge distinct heard replies without overwriting each other', async (t) => {
  const entries = new Map(),
    storage = {
      getItem: (key) => entries.get(key) ?? null,
      setItem: (key, value) => entries.set(key, value),
    };
  const response = (text) =>
    new Response(new Uint8Array([1, 2, 3]), {
      headers: {
        'content-type': 'audio/mpeg',
        'x-trip-voice-text': encodeURIComponent(text),
      },
    });
  const first = fixture(() => response('Visit Seoul Forest.'), { storage });
  const second = fixture(() => response('Explore Busan after Seoul.'), {
    storage,
  });
  t.after(() => {
    first.player.dispose();
    second.player.dispose();
  });
  first.player.setIdentity('member-one');
  second.player.setIdentity('member-one');
  first.player.setEnabled(true);
  second.player.setEnabled(true);
  let finishSecond;
  const secondReady = new Promise((ready) => {
    second.audio.play = () => {
      second.audio.plays += 1;
      ready();
      return new Promise((finish) => {
        finishSecond = finish;
      });
    };
  });
  const pendingSecond = second.player.speak({
    event: 'assistant',
    messageId: 'message-busan',
    text: 'Explore Busan after Seoul.',
  });
  await secondReady;
  assert.equal(entries.size, 0);
  await first.player.speak({
    event: 'assistant',
    messageId: 'message-seoul',
    text: 'Visit Seoul Forest.',
  });
  finishSecond();
  await pendingSecond;
  const saved = JSON.parse([...entries.values()][0]);
  assert.deepEqual(
    new Set(saved.events),
    new Set(['message-seoul', 'message-busan']),
  );
  assert.deepEqual(
    new Set(saved.texts),
    new Set(['visit seoul forest', 'explore busan after seoul']),
  );
  await first.player.speak({
    event: 'assistant',
    messageId: 'message-busan-other',
    text: 'Explore Busan after Seoul!',
  });
  await second.player.speak({
    event: 'assistant',
    messageId: 'message-seoul-other',
    text: 'Visit Seoul Forest!',
  });
  assert.equal(first.requests.length, 1);
  assert.equal(second.requests.length, 1);
});
