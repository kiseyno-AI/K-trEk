import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import path from 'node:path';
import test from 'node:test';
import vm from 'node:vm';
import React from 'react';
import ts from 'typescript';
import { parseActivity, toActivity } from '../lib/activities.ts';
import { DEFAULT_TRIP_ORIGIN, resolveTripOrigin } from '../lib/trip-origin.ts';

const require = createRequire(import.meta.url);
const root = path.resolve(import.meta.dirname, '..');
const sources = new Map();
const activity = toActivity(parseActivity({
  id: 'ownership-palace', name_en: 'Royal Palace', name_ko: '궁궐',
  summary_en: 'Explore the palace.', published: true,
}));

// A small hook owner/reconciliation harness: browser, media and network owners
// are replaced; actual page/control callbacks, memo and state ownership run.
async function mountedPage({ fetch: fetchMock, voiceEnabled = true } = {}) {
  let current;
  let clock = Date.parse('2026-11-16T12:00:00Z');
  const dirty = new Set(), effects = [], microtasks = [], timers = new Map();
  const intervals = new Map(), events = [], modules = new Map(), counts = new Map();
  let timerId = 0;
  const equal = (a, b) => a?.length === b?.length && a?.every((v, i) => Object.is(v, b[i]));
  const shallow = (a, b) => Object.keys(a).length === Object.keys(b).length &&
    Object.keys(a).every((key) => Object.is(a[key], b[key]));
  const slot = () => [current, current.cursor++];
  const effect = (callback, deps) => {
    const [owner, index] = slot(), before = owner.hooks[index];
    if (!before || !equal(before.deps, deps)) {
      const next = { deps, cleanup: before?.cleanup };
      owner.hooks[index] = next;
      effects.push(() => { next.cleanup?.(); next.cleanup = callback(); });
    }
  };
  const hooks = {
    ...React,
    useState(initial) {
      const [owner, index] = slot();
      if (!(index in owner.hooks)) owner.hooks[index] = typeof initial === 'function' ? initial() : initial;
      return [owner.hooks[index], (value) => {
        const next = typeof value === 'function' ? value(owner.hooks[index]) : value;
        if (!Object.is(next, owner.hooks[index])) { owner.hooks[index] = next; dirty.add(owner); }
      }];
    },
    useRef(initial) { const [owner, index] = slot(); return owner.hooks[index] ??= { current: initial }; },
    useMemo(callback, deps) {
      const [owner, index] = slot();
      if (!owner.hooks[index] || !equal(owner.hooks[index].deps, deps)) owner.hooks[index] = { deps, value: callback() };
      return owner.hooks[index].value;
    },
    useCallback(callback, deps) { return hooks.useMemo(() => callback, deps); },
    useEffect: effect,
    useLayoutEffect: effect,
    useImperativeHandle(ref, create, deps) {
      effect(() => {
        const value = create();
        if (typeof ref === 'function') ref(value); else if (ref) ref.current = value;
        return () => { if (typeof ref === 'function') ref(null); else if (ref) ref.current = null; };
      }, [...(deps ?? []), ref]);
    },
  };
  const element = (type) => function StubElement(props) { return React.createElement(type, props); };
  function PlanetCanvas({ intro, detailZoom, onBrowseReady }) {
    hooks.useEffect(() => { if (!intro && !detailZoom) onBrowseReady?.(); }, [intro, detailZoom, onBrowseReady]);
    return null;
  }
  const noop = () => {};
  const media = { setIdentity: noop, setEnabled: noop, speak: async () => {}, stop: noop, dispose: noop, replay: async () => {} };
  const client = { record: (...args) => events.push(args), setVisible: noop, setVoiceEnabled: noop, dispose: noop, pagehide: noop, markHeard: async () => {} };
  const globals = {
    Date: class extends Date { static now() { return clock; } },
    performance, crypto, AbortController, URL,
    document: { visibilityState: 'visible', hidden: false, addEventListener: noop, removeEventListener: noop, activeElement: null },
    window: { innerWidth: 1440, addEventListener: noop, removeEventListener: noop },
    matchMedia: () => ({ matches: true, addEventListener: noop, removeEventListener: noop }),
    localStorage: { getItem: () => null, setItem: noop },
    queueMicrotask: (callback) => microtasks.push(callback),
    setTimeout: (callback, delay) => { const id = ++timerId; timers.set(id, { callback, delay }); return id; },
    clearTimeout: (id) => timers.delete(id),
    setInterval: (callback) => { const id = ++timerId; intervals.set(id, callback); return id; },
    clearInterval: (id) => intervals.delete(id),
    requestAnimationFrame: (callback) => { microtasks.push(() => callback(clock)); return ++timerId; },
    cancelAnimationFrame: noop,
    fetch: fetchMock ?? (async () => Response.json({ favoriteIds: [], status: 'upstream_error' })),
  };
  function load(file) {
    if (modules.has(file)) return modules.get(file).exports;
    if (file.endsWith('.json')) return require(file);
    const loaded = { exports: {} }; modules.set(file, loaded);
    if (!sources.has(file)) sources.set(file, ts.transpileModule(readFileSync(file, 'utf8'), {
      compilerOptions: { module: ts.ModuleKind.CommonJS, jsx: ts.JsxEmit.ReactJSX, target: ts.ScriptTarget.ES2022 },
    }).outputText);
    vm.runInNewContext(sources.get(file), { ...globals, module: loaded, exports: loaded.exports, require(id) {
      if (id === 'react') return hooks;
      if (id === 'next/image') return { __esModule: true, default: element('img') };
      if (id === 'lucide-react') return new Proxy({}, { get: () => element('svg') });
      if (id.endsWith('.css')) return { __esModule: true, default: new Proxy({}, { get: (_o, key) => String(key) }) };
      if (id === './planet-canvas') return { PlanetCanvas };
      if (id === './animated-countdown') return { AnimatedCountdown: element('time') };
      if (id === './trip-login') return { TripLogin: element('section') };
      if (id === './host-reviews') return { HostReviews: element('section') };
      if (id === './trip-community') return {
        CommunityControls: element('section'), ReportComposer: element('section'),
        useMemberPreferences: () => ({ recordCategory: noop, syncError: '', flushPreferences: async () => {} }),
      };
      if (id === '../lib/trip-session') return { readTripSession: async () => ({ id: 'member-one', name: 'Alex', role: 'member' }) };
      if (id === '../lib/site-path') return { sitePath: (value) => value };
      if (id === '../lib/trip-voice-player') return { createTripVoicePlayer: () => {
        counts.set('voice player', (counts.get('voice player') ?? 0) + 1);
        return media;
      } };
      if (id === '../lib/trip-interaction-client') return { createTripInteractionClient: () => {
        counts.set('voice interaction client', (counts.get('voice interaction client') ?? 0) + 1);
        return client;
      } };
      if (!id.startsWith('.')) return require(id);
      let target = path.resolve(path.dirname(file), id);
      if (!path.extname(target)) target += id === './trip-voice' ? '.tsx' : '.ts';
      return load(target);
    } }, { filename: file });
    return loaded.exports;
  }
  function reconcile(node, previous, parent) {
    if (!node || typeof node !== 'object') return null;
    if (Array.isArray(node)) return { children: node.map((child, index) => reconcile(child, previous?.children[index], parent)) };
    const memoized = node.type?.$$typeof === Symbol.for('react.memo');
    const component = memoized ? node.type.type : node.type;
    const owner = previous?.type === node.type ? previous : { type: node.type, hooks: [], children: [], parent };
    if (memoized && previous === owner && !dirty.has(owner) && shallow(owner.props, node.props)) return owner;
    owner.props = node.props;
    if (typeof component === 'function') {
      current = owner; owner.cursor = 0; dirty.delete(owner);
      const name = component.name || 'anonymous'; counts.set(name, (counts.get(name) ?? 0) + 1);
      const output = component(node.props); current = null;
      owner.children = [reconcile(output, owner.children[0], owner)];
    } else owner.children = React.Children.toArray(node.props?.children).map((child, index) => reconcile(child, owner.children[index], owner));
    return owner;
  }
  const App = load(path.join(root, 'app/activity-explorer.tsx')).default;
  const tree = reconcile(React.createElement(App, { activities: [activity], origin: DEFAULT_TRIP_ORIGIN, voiceEnabled }));
  async function settle() {
    for (let i = 0; i < 24; i++) {
      while (effects.length) effects.shift()();
      while (microtasks.length) microtasks.shift()();
      for (const [id, timer] of timers) if (timer.delay === 0) { timers.delete(id); timer.callback(); }
      await Promise.resolve();
      for (const owner of dirty) {
        let ancestor = owner.parent;
        while (ancestor && !dirty.has(ancestor)) ancestor = ancestor.parent;
        if (!ancestor && dirty.has(owner)) reconcile({ type: owner.type, props: owner.props }, owner, owner.parent);
      }
    }
  }
  function find(predicate, owner = tree) {
    if (!owner) return null;
    if (predicate(owner)) return owner;
    for (const child of owner.children) { const found = find(predicate, child); if (found) return found; }
    return null;
  }
  await settle();
  return {
    find: (predicate) => find((owner) => typeof owner.type === 'string' && predicate(owner)),
    count: (name) => counts.get(name) ?? 0, events, settle,
    tick: async () => { clock += 1000; intervals.forEach((callback) => callback()); await settle(); },
  };
}

await test('disabled Voice never creates audio or interaction owners during card navigation and voting', async () => {
  const view = await mountedPage({ voiceEnabled: false });
  assert.equal(view.find((node) => node.props['aria-label'] === 'Open trip voice'), null);
  view.find((node) => node.type === 'article' && node.props['data-activity-id'] === activity.id).props.onClick({ currentTarget: null });
  await view.settle();
  view.find((node) => node.type === 'button' && node.props.className === 'select').props.onClick();
  await view.tick();
  assert.equal(view.count('TripVoiceHost'), 0);
  assert.equal(view.count('voice player'), 0);
  assert.equal(view.count('voice interaction client'), 0);
  assert.deepEqual(view.events, []);
});

await test('opening and typing in Voice update only the assistant owner, leaving the page and globe untouched', async () => {
  const view = await mountedPage();
  const before = { page: view.count('ActivityExplorer'), globe: view.count('PlanetCanvas') };
  view.find((node) => node.props['aria-label'] === 'Open trip voice').props.onClick();
  await view.settle();
  for (const value of ['S', 'Se', 'Seoul']) {
    view.find((node) => node.type === 'textarea' && node.props.id === 'trip-chat-input').props.onChange({ target: { value } });
    await view.settle();
  }
  assert.equal(view.find((node) => node.props.id === 'trip-chat-input').props.value, 'Seoul');
  assert.equal(view.count('ActivityExplorer') - before.page, 0, 'voice opening/typing must not render ActivityExplorer');
  assert.equal(view.count('PlanetCanvas') - before.globe, 0, 'voice opening/typing must not render PlanetCanvas');
});

await test('the assistant action ref preserves card-open and vote events, and unchanged parent ticks skip the assistant', async () => {
  const view = await mountedPage();
  view.find((node) => node.type === 'article' && node.props['data-activity-id'] === activity.id).props.onClick({ currentTarget: null });
  await view.settle();
  view.find((node) => node.type === 'button' && node.props.className === 'select').props.onClick();
  await view.settle();
  assert.deepEqual(view.events, [['card_open', activity.id], ['vote_added', activity.id]]);
  const before = view.count('TripVoiceControl');
  const pageBefore = view.count('ActivityExplorer');
  await view.tick();
  assert.equal(view.count('ActivityExplorer'), pageBefore + 1, 'the fixture must actually deliver a parent countdown update');
  assert.equal(view.count('TripVoiceControl'), before, 'unchanged parent countdown ticks must skip the assistant');
});

await test('departure selection clears old roads, aborts superseded requests, and only displays the latest origin response', async () => {
  const requests = [];
  const view = await mountedPage({ fetch: (url, options) => {
    if (!url.includes('/directions/')) return Promise.resolve(Response.json({ favoriteIds: [] }));
    return new Promise((resolve) => requests.push({ url, signal: options.signal, resolve }));
  } });
  const open = () => view.find((node) => node.type === 'article' && node.props['data-activity-id'] === activity.id).props.onClick({ currentTarget: null });
  const departure = () => view.find((node) => node.type === 'select' && node.props.id === 'trip-departure');
  const minutes = (text) => view.find((node) => node.type === 'strong' && node.props.children === text);
  const respond = (index, id, durationSeconds) => requests[index].resolve(Response.json({
    status: 'ok', activityId: activity.id, origin: resolveTripOrigin(id, DEFAULT_TRIP_ORIGIN),
    path: [[126.97, 37.55], [127, 37.56]], durationSeconds, distanceMeters: 2000,
    taxiFareKrw: 6000, tollFareKrw: 0, transitOptions: [], transitStatus: 'no_route',
    fetchedAt: new Date().toISOString(), provider: 'kakao',
  }));
  open(); await view.settle();
  assert.ok(departure(), 'members can select a departure inside the expanded card');
  assert.equal(React.Children.count(departure().props.children), 5);
  respond(0, null, 600); await view.settle();
  assert.ok(minutes('10 min'));
  for (const id of ['gangnam-station', 'sinchon-station', 'yangjae-station']) {
    departure().props.onChange({ target: { value: id } }); await view.settle();
    assert.equal(new URL(requests.at(-1).url, 'https://example.test').searchParams.get('origin'), id);
    assert.equal(requests.at(-2).signal.aborted, true);
    assert.equal(minutes('10 min'), null, 'stale travel totals disappear immediately');
  }
  respond(3, 'yangjae-station', 300); await view.settle();
  respond(1, 'gangnam-station', 1200); await view.settle();
  requests[2].resolve(Response.json({ status: 'upstream_error', message: 'Old request failed.' }));
  await view.settle();
  assert.ok(minutes('5 min'), 'late successes and errors cannot overwrite the current departure');
  assert.equal(minutes('20 min'), null);
  assert.equal(departure().props.value, 'yangjae-station');
  await view.tick();
  assert.equal(requests.length, 4, 'countdown updates do not restart directions');
  view.find((node) => node.props.className === 'back').props.onClick(); await view.settle();
  open(); await view.settle();
  assert.equal(departure().props.value, 'yangjae-station', 'the next card keeps the chosen departure');
  assert.equal(requests.length, 5);
});
