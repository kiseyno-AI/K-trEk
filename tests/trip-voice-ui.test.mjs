import assert from 'node:assert/strict';
import test from 'node:test';
import { readFile } from 'node:fs/promises';
import { createRequire } from 'node:module';
import vm from 'node:vm';
import ts from 'typescript';
import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { createTripVoicePlayer } from '../lib/trip-voice-player.ts';
import { createTripInteractionClient } from '../lib/trip-interaction-client.ts';

const require = createRequire(import.meta.url);
const code = ts.transpileModule(
  await readFile(new URL('../app/trip-voice.tsx', import.meta.url), 'utf8'),
  {
    compilerOptions: {
      module: ts.ModuleKind.CommonJS,
      jsx: ts.JsxEmit.ReactJSX,
      target: ts.ScriptTarget.ES2022,
    },
  },
).outputText;
function component(hooks = React) {
  const loadedModule = { exports: {} };
  vm.runInNewContext(code, {
    module: loadedModule,
    exports: loadedModule.exports,
    require: (id) =>
      id.endsWith('.module.css')
        ? {
            __esModule: true,
            default: new Proxy({}, { get: (_o, k) => String(k) }),
          }
        : id === 'react'
          ? { ...React, ...hooks }
          : id === '../lib/trip-voice-player'
            ? { createTripVoicePlayer }
            : id === '../lib/trip-interaction-client'
              ? { createTripInteractionClient }
              : id === '../lib/site-path'
                ? { sitePath: (path) => path }
                : require(id),
  });
  return loadedModule.exports.TripVoiceControl;
}
const base = {
  enabled: false,
  open: false,
  state: { phase: 'off', text: '', message: '' },
  signedIn: true,
  chatOpen: true,
  messages: [],
  chatInput: '',
  chatBusy: false,
  chatError: '',
  reportBusy: null,
  sentReports: [],
  canRetry: false,
  toggle() {},
  replay() {},
  retry() {},
  dismiss() {},
  openChat() {},
  closeChat() {},
  setChatInput() {},
  sendChat() {},
  retryChat() {},
  askShawn() {},
};
const Control = component();
const render = (overrides = {}) =>
  renderToStaticMarkup(
    React.createElement(Control, { voice: { ...base, ...overrides } }),
  );
function findElement(node, predicate) {
  if (!node || typeof node !== 'object') return null;
  if (predicate(node)) return node;
  for (const child of React.Children.toArray(node.props?.children)) {
    const found = findElement(child, predicate);
    if (found) return found;
  }
  return null;
}
await test('one header Voice button opens the trip dialog with sound controls inside, even when sound is off', () => {
  const html = render();
  const beforeDialog = html.split('<dialog')[0];
  assert.equal((beforeDialog.match(/<button\b/gu) ?? []).length, 1);
  assert.match(beforeDialog, /aria-label="Open trip voice"/u);
  assert.doesNotMatch(beforeDialog, /Turn voice on|Open trip chat|>Chat</u);
  const dialogMarkup = html.slice(html.indexOf('<dialog'));
  assert.match(dialogMarkup, /aria-label="Turn voice on"/u);
  assert.match(dialogMarkup, /aria-labelledby="trip-chat-title"/u);
  assert.match(dialogMarkup, /You can chat with voice off/u);
  assert.match(dialogMarkup, /maxLength="1000"/iu);
  const visitor = render({ signedIn: false });
  assert.match(visitor, /aria-label="Open trip voice"/u);
  assert.match(visitor, /aria-labelledby="trip-chat-title"/u);
  assert.doesNotMatch(visitor, /trip-chat-input|reportButton/u);
});

await test('chat and speech loading show a named Thinking ellipsis and disable writing and sending', () => {
  for (const busy of [
    { chatBusy: true },
    { eventBusy: true },
    { state: { phase: 'loading', text: '', message: 'Preparing voice…' } },
  ]) {
    const html = render({ ...busy, chatInput: 'Can we visit?' });
    assert.match(
      html,
      /<output[^>]*aria-label="Thinking"[^>]*>\.\.\.<\/output>/u,
    );
    assert.match(html, /<textarea[^>]*disabled=""/u);
    assert.match(html, /<button[^>]*type="submit"[^>]*disabled=""/u);
  }
});
await test('assistant replies expose source links and an explicit report draft action, and errors retain a question retry', () => {
  const html = render({
    messages: [
      {
        id: 'reply-one',
        role: 'assistant',
        text: 'Check this place.',
        sources: [
          {
            activityId: 'samwon',
            title: 'Samwon Garden',
            url: 'https://example.com/samwon',
          },
        ],
        reportDraft: 'Can we reserve a table?',
      },
    ],
    chatError: 'The assistant timed out.',
    canRetry: true,
    chatInput: 'Can ten people visit?',
  });
  assert.match(html, /https:\/\/example.com\/samwon/);
  assert.match(html, /Can we reserve a table\?/);
  assert.match(html, />Ask Shawn</);
  assert.match(html, /role="alert"/);
  assert.match(html, />Retry question</);
  assert.match(html, /Can ten people visit\?/);
  assert.doesNotMatch(html, /Traffic, transit|unverified/);
});
await test('rendering a report draft sends nothing; only its explicit action invokes the report callback', () => {
  let sent = 0;
  const NativeControl = component({
    useRef: () => ({ current: null }),
    useEffect: () => {},
  });
  const reply = {
    id: 'reply-one',
    role: 'assistant',
    text: 'Ask the host.',
    sources: [],
    reportDraft: 'A report for Shawn.',
  };
  const tree = NativeControl({
    voice: {
      ...base,
      messages: [reply],
      askShawn: (value) => {
        assert.equal(value.id, 'reply-one');
        sent += 1;
      },
    },
  });
  const button = findElement(
    tree,
    (node) => node.type === 'button' && node.props.className === 'reportButton',
  );
  assert.equal(sent, 0);
  assert.ok(button);
  button.props.onClick();
  assert.equal(sent, 1);
});

await test('the mobile icon-only submit control keeps its Send accessible name when the visible text is hidden', () => {
  const html = render({ chatInput: 'What should we visit?' });
  const submit = html.match(/<button\b[^>]*type="submit"[^>]*>/u)?.[0];
  assert.ok(submit);
  assert.match(submit, /aria-label="Send"/u);
});

await test('the header opens the dialog without enabling speech, and its native Escape handlers preserve the underlying page', () => {
  let opens = 0,
    toggles = 0,
    closes = 0,
    prevented = 0,
    stopped = 0;
  const NativeControl = component({
    useRef: () => ({ current: null }),
    useEffect: () => {},
  });
  const tree = NativeControl({
    voice: {
      ...base,
      openChat: () => opens++,
      toggle: () => toggles++,
      closeChat: () => closes++,
    },
  });
  const launcher = findElement(
    tree,
    (node) =>
      node.type === 'button' && node.props['aria-label'] === 'Open trip voice',
  );
  launcher.props.onClick();
  assert.equal(opens, 1);
  assert.equal(toggles, 0);
  const dialog = findElement(tree, (node) => node.type === 'dialog');
  const toggle = findElement(
    dialog,
    (node) =>
      node.type === 'button' && node.props['aria-label'] === 'Turn voice on',
  );
  toggle.props.onClick();
  assert.equal(toggles, 1);
  dialog.props.onCancel({ preventDefault: () => prevented++ });
  dialog.props.onKeyDown({ key: 'Escape', stopPropagation: () => stopped++ });
  assert.equal(closes, 1);
  assert.equal(prevented, 1);
  assert.equal(stopped, 1);
});

await test('a loading form cannot dispatch a question even when a native submit event is delivered', () => {
  const NativeControl = component({
    useRef: () => ({ current: null }),
    useEffect: () => {},
  });
  for (const busy of [
    { chatBusy: true },
    { state: { phase: 'loading', text: '', message: '' } },
  ]) {
    let sent = 0;
    const tree = NativeControl({
      voice: {
        ...base,
        ...busy,
        chatInput: 'Where should we visit?',
        sendChat: () => sent++,
      },
    });
    const form = findElement(tree, (node) => node.type === 'form');
    form.props.onSubmit({ preventDefault() {} });
    assert.equal(sent, 0);
  }
});
