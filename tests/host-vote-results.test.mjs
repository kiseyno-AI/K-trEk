import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { createRequire } from 'node:module';
import test from 'node:test';
import vm from 'node:vm';
import { setImmediate } from 'node:timers/promises';
import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import ts from 'typescript';
import { communityRequest, CommunityRequestError } from '../lib/trip-community-client.ts';
import { MAX_VOTES } from '../lib/vote-planning.ts';

const require = createRequire(import.meta.url);
const code = ts.transpileModule(
  await readFile(new URL('../app/host-vote-results.tsx', import.meta.url), 'utf8'),
  { compilerOptions: { module: ts.ModuleKind.CommonJS, jsx: ts.JsxEmit.ReactJSX, target: ts.ScriptTarget.ES2022 } },
).outputText;
const activities = [
  { id: 'palace', title: 'Royal Palace' },
  { id: 'garden', title: 'Samwon Garden' },
];

function mountedView(onSessionExpired) {
  const slots = [], effects = [], cleanups = [];
  let cursor = 0, mounted = false, disposedWrites = 0;
  const dialog = { open: false, showModal() { this.open = true; }, close() { this.open = false; } };
  const launcher = { isConnected: true, focuses: 0, focus() { this.focuses++; } };
  const equal = (a, b) => a?.length === b?.length && a?.every((v, i) => Object.is(v, b[i]));
  const hooks = {
    ...React,
    useState(initial) {
      const index = cursor++;
      if (!(index in slots)) slots[index] = typeof initial === 'function' ? initial() : initial;
      return [slots[index], (value) => {
        if (!mounted) disposedWrites++;
        slots[index] = typeof value === 'function' ? value(slots[index]) : value;
      }];
    },
    useRef(initial) { const index = cursor++; return slots[index] ??= { current: initial }; },
    useEffect(callback, deps) {
      const index = cursor++;
      if (!slots[index] || !equal(slots[index].deps, deps)) {
        const before = slots[index]; slots[index] = { deps };
        effects.push(() => { before?.cleanup?.(); slots[index].cleanup = callback(); });
        cleanups[index] = () => slots[index].cleanup?.();
      }
    },
  };
  const compiledModule = { exports: {} };
  vm.runInNewContext(code, {
    module: compiledModule, exports: compiledModule.exports, AbortController, queueMicrotask,
    require(id) {
      if (id === 'react') return hooks;
      if (id.endsWith('.module.css')) return { __esModule: true, default: new Proxy({}, { get: (_o, key) => String(key) }) };
      if (id === '../lib/trip-community-client') return { communityRequest, CommunityRequestError };
      if (id === '../lib/vote-planning') return { MAX_VOTES };
      return require(id);
    },
  });
  const Component = compiledModule.exports.HostVoteResults;
  let tree;
  function visit(node, fn) {
    if (!node || typeof node !== 'object') return;
    fn(node);
    for (const child of React.Children.toArray(node.props?.children)) visit(child, fn);
  }
  const view = {
    dialog, launcher,
    render(ready = true) {
      cursor = 0;
      tree = Component({ activities, ready, onSessionExpired });
      visit(tree, (node) => { if (node.type === 'dialog' && node.props.ref) node.props.ref.current = dialog; });
      mounted = true;
      while (effects.length) effects.shift()();
      return tree;
    },
    find(predicate) { view.render(); let found; visit(tree, (node) => { if (!found && predicate(node)) found = node; }); return found; },
    html() { return renderToStaticMarkup(view.render()); },
    async open() {
      view.find((node) => node.props['aria-label'] === 'Voting results').props.onClick({ currentTarget: launcher });
      view.render(); await setImmediate(); view.render();
    },
    unmount() { launcher.isConnected = false; cleanups.forEach((cleanup) => cleanup?.()); mounted = false; },
    disposedWrites: () => disposedWrites,
  };
  view.render();
  return view;
}

await test('hosts fetch only on opening and see real per-activity totals plus named ballots', async (t) => {
  const calls = [];
  t.mock.method(globalThis, 'fetch', async (url, options) => {
    calls.push({ url, signal: options.signal });
    return Response.json({ votes: [
      { id: 'alex', name: 'Alex', submittedVoteIds: ['palace', 'garden', 'garden'] },
      { id: 'sam', name: 'Sam', submittedVoteIds: ['garden'] },
    ] });
  });
  const view = mountedView(); t.after(() => view.unmount());
  assert.equal(calls.length, 0);
  assert.equal(view.launcher.focuses, 0, 'a closed dialog must not steal page focus');
  assert.match(view.html(), /aria-label="Voting results"/);
  await view.open();
  assert.equal(calls.length, 1);
  assert.equal(calls[0].url, '/api/members?view=votes');
  const html = view.html();
  assert.match(html, /2 members submitted/);
  assert.match(html, /3 selections/);
  assert.match(html, /Samwon Garden<\/strong>.*?2 votes/s);
  assert.match(html, /Royal Palace<\/strong>.*?1 vote/s);
  assert.ok(html.indexOf('Samwon Garden') < html.indexOf('Royal Palace'), 'the most-voted activity appears first');
  assert.match(html, /Votes by member/);
  assert.match(html, /Alex/); assert.match(html, /Sam/);
});

await test('failed and malformed responses offer retry, then show an empty result', async (t) => {
  const responses = [
    Response.json({ error: 'Please try later.' }, { status: 503 }),
    Response.json(null),
    Response.json({ votes: [] }),
  ];
  let calls = 0;
  t.mock.method(globalThis, 'fetch', async () => { calls++; return responses.shift(); });
  const view = mountedView(); t.after(() => view.unmount());
  await view.open();
  assert.match(view.html(), /role="alert"/);
  assert.match(view.html(), /Please try later\./);
  view.find((node) => node.type === 'button' && node.props.children === 'Try again').props.onClick();
  await setImmediate();
  assert.match(view.html(), /Vote results could not be read\. Please try again\./);
  view.find((node) => node.type === 'button' && node.props.children === 'Try again').props.onClick();
  await setImmediate();
  assert.match(view.html(), /No votes submitted yet\./);
  assert.equal(calls, 3, 'requests run only on open or explicit retry');
  assert.equal(view.find((node) => node.props.role === 'alert'), undefined);
});

await test('expired sessions notify the parent without exposing stale results', async (t) => {
  t.mock.method(globalThis, 'fetch', async () => Response.json({ error: 'Please sign in again.' }, { status: 401 }));
  let expirations = 0;
  const view = mountedView(() => { expirations++; }); t.after(() => view.unmount());
  await view.open();
  assert.equal(expirations, 1);
  assert.match(view.html(), /Please sign in again\./);
  assert.doesNotMatch(view.html(), /Votes by member/);
});

await test('backdrop and Escape dismiss, abort pending reads, and restore focus', async (t) => {
  const requests = [];
  t.mock.method(globalThis, 'fetch', (_url, options) => new Promise((resolve) => {
    requests.push({ signal: options.signal, resolve });
  }));
  const view = mountedView(); t.after(() => view.unmount());
  await view.open();
  assert.match(view.html(), /Loading votes/);
  const modal = view.find((node) => node.type === 'dialog');
  modal.props.onClick({ target: {}, currentTarget: view.dialog });
  assert.equal(view.dialog.open, true, 'clicks inside the dialog leave it open');
  modal.props.onClick({ target: view.dialog, currentTarget: view.dialog });
  await setImmediate();
  assert.equal(view.dialog.open, false);
  assert.equal(requests[0].signal.aborted, true);
  assert.equal(view.launcher.focuses, 1);
  await view.open();
  requests[0].resolve(Response.json({ votes: [{ id: 'old', name: 'Old ballot', submittedVoteIds: ['palace'] }] }));
  await setImmediate();
  assert.match(view.html(), /Loading votes/, 'an earlier response cannot replace a reopened request');
  assert.doesNotMatch(view.html(), /Old ballot/);
  let prevented = false;
  view.find((node) => node.type === 'dialog').props.onCancel({ preventDefault() { prevented = true; } });
  requests[1].resolve(Response.json({ votes: [] }));
  await setImmediate();
  assert.equal(prevented, true);
  assert.equal(requests[1].signal.aborted, true);
  assert.equal(view.dialog.open, false);
  assert.equal(view.launcher.focuses, 2);
});

await test('unmount aborts the request and ignores late responses without state writes', async (t) => {
  let pending;
  t.mock.method(globalThis, 'fetch', (_url, options) => new Promise((resolve) => {
    pending = { signal: options.signal, resolve };
  }));
  const view = mountedView();
  await view.open();
  view.unmount();
  assert.equal(pending.signal.aborted, true);
  pending.resolve(Response.json({ votes: [] }));
  await setImmediate();
  assert.equal(view.disposedWrites(), 0);
  assert.equal(view.launcher.focuses, 0);
});
