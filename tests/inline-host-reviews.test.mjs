import assert from 'node:assert/strict';
import test from 'node:test';
import { readFile } from 'node:fs/promises';
import { createRequire } from 'node:module';
import vm from 'node:vm';
import ts from 'typescript';
import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { parseActivity, toActivity } from '../lib/activities.ts';

const require = createRequire(import.meta.url);
const source = await readFile(
  new URL('../app/host-reviews.tsx', import.meta.url),
  'utf8',
);
const code = ts.transpileModule(source, {
  compilerOptions: {
    module: ts.ModuleKind.CommonJS,
    jsx: ts.JsxEmit.ReactJSX,
    target: ts.ScriptTarget.ES2022,
  },
}).outputText;
function component(hooks = React) {
  const loadedModule = { exports: {} };
  vm.runInNewContext(code, {
    module: loadedModule,
    exports: loadedModule.exports,
    AbortController,
    setTimeout,
    clearTimeout,
    fetch: (...args) => fetch(...args),
    require: (id) =>
      id.endsWith('.module.css')
        ? {
            __esModule: true,
            default: new Proxy({}, { get: (_object, key) => String(key) }),
          }
        : id === 'react'
          ? hooks
          : id === '../lib/site-path'
            ? { sitePath: (value) => value }
            : require(id),
  });
  return loadedModule.exports.HostReviews;
}
const HostReviews = component();
const activity = toActivity(
  parseActivity({
    id: 'inline-review',
    name_ko: '리뷰',
    name_en: 'Review place',
    shawn_rating: 4,
    shawn_comment: 'A memorable visit. I would come back.',
  }),
);
const render = (canEdit) =>
  renderToStaticMarkup(
    React.createElement(HostReviews, {
      activity,
      canEdit,
      onSaved() {},
    }),
  );

void test('members read host comments and ratings without any editing controls', () => {
  const html = render(false);
  assert.match(html, /A memorable visit/);
  assert.match(html, /4 out of 5 stars/);
  assert.match(html, /Sun hasn&#x27;t added a comment yet/);
  assert.doesNotMatch(html, /<(?:form|textarea|input|button)\b/);
});

void test('admins have independently labeled star/comment inputs and one explicit save action', () => {
  const html = render(true);
  assert.equal((html.match(/<textarea\b/g) ?? []).length, 2);
  assert.equal((html.match(/type="radio"/g) ?? []).length, 12);
  assert.match(html, /Set Shawn&#x27;s rating/);
  assert.match(html, /Set Sun&#x27;s rating/);
  assert.equal((html.match(/>Save comments</g) ?? []).length, 1);
});

function editableView(onSaved, record = activity) {
  const slots = [],
    cleanups = [];
  let cursor = 0;
  let mounted = false;
  const Review = component({
    useId: () => 'review-test',
    useState: (initial) => {
      const index = cursor++;
      if (!(index in slots))
        slots[index] = typeof initial === 'function' ? initial() : initial;
      return [
        slots[index],
        (next) => {
          slots[index] = typeof next === 'function' ? next(slots[index]) : next;
        },
      ];
    },
    useRef: (initial) => {
      const index = cursor++;
      if (!(index in slots)) slots[index] = { current: initial };
      return slots[index];
    },
    useEffect: (effect) => {
      if (!mounted) {
        const cleanup = effect();
        if (cleanup) cleanups.push(cleanup);
      }
    },
  });
  const view = {
    render() {
      cursor = 0;
      const tree = Review({ activity: record, canEdit: true, onSaved });
      mounted = true;
      return tree;
    },
    submit() {
      return view.render().props.onSubmit({ preventDefault() {} });
    },
    html() {
      return renderToStaticMarkup(view.render());
    },
    unmount() {
      cleanups.forEach((cleanup) => cleanup());
    },
  };
  view.render();
  return view;
}

void test('an admin save sends only four review fields and publishes the server-confirmed values', async (t) => {
  const confirmed = {
    shawn_rating: 4,
    sun_rating: null,
    shawn_comment: 'A memorable visit. I would come back.',
    sun_comment: null,
  };
  let written;
  const saved = [];
  t.mock.method(globalThis, 'fetch', async (url, options) => {
    written = {
      url,
      method: options.method,
      payload: JSON.parse(options.body),
    };
    return Response.json({ reviews: confirmed });
  });
  const view = editableView((reviews) =>
    saved.push(JSON.parse(JSON.stringify(reviews))),
  );
  await view.submit();
  assert.deepEqual(written, {
    url: '/api/activities/inline-review/reviews',
    method: 'PATCH',
    payload: confirmed,
  });
  assert.deepEqual(saved, [confirmed]);
  assert.match(view.html(), /role="status">Comments saved/);
  view.unmount();
});

void test('failed or malformed save responses retain the draft and never announce a confirmed save', async (t) => {
  const saved = [];
  const mock = t.mock.method(globalThis, 'fetch', async () =>
    Response.json({ error: 'Try later.' }, { status: 503 }),
  );
  for (const response of [
    () => Response.json({ error: 'Try later.' }, { status: 503 }),
    () => Response.json({ reviews: { shawn_rating: 6 } }),
  ]) {
    mock.mock.mockImplementation(async () => response());
    const view = editableView((reviews) => saved.push(reviews));
    await view.submit();
    const html = view.html();
    assert.match(html, /role="alert"/);
    assert.match(html, /A memorable visit/);
    assert.doesNotMatch(html, /Comments saved/);
    view.unmount();
  }
  assert.deepEqual(saved, []);
});

void test('disposal aborts an in-flight save and a timed-out save exposes its preserved draft', async (t) => {
  t.mock.timers.enable({ apis: ['setTimeout'] });
  let signal;
  const saved = [];
  t.mock.method(globalThis, 'fetch', (_url, options) => {
    signal = options.signal;
    return new Promise((_resolve, reject) =>
      signal.addEventListener('abort', () => reject(new Error('Aborted')), {
        once: true,
      }),
    );
  });
  const abandoned = editableView((reviews) => saved.push(reviews));
  const first = abandoned.submit();
  abandoned.unmount();
  await first;
  assert.equal(signal.aborted, true);
  const timed = editableView((reviews) => saved.push(reviews));
  const second = timed.submit();
  t.mock.timers.tick(12000);
  await second;
  assert.equal(signal.aborted, true);
  assert.match(timed.html(), /Saving timed out/);
  assert.match(timed.html(), /A memorable visit/);
  assert.deepEqual(saved, []);
  timed.unmount();
});
