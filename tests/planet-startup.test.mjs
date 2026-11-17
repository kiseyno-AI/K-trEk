import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import vm from 'node:vm';
import ts from 'typescript';

const source = await readFile(
  new URL('../app/planet-canvas.tsx', import.meta.url),
  'utf8',
);
const code = ts.transpileModule(source, {
  compilerOptions: {
    module: ts.ModuleKind.CommonJS,
    jsx: ts.JsxEmit.ReactJSX,
    target: ts.ScriptTarget.ES2022,
  },
}).outputText;

function fixture(failure = 'pending-assets') {
  const effects = [],
    cleanups = [],
    timers = new Map(),
    frames = new Map(),
    observers = [],
    events = new Map();
  const live = {
    shaders: new Set(),
    programs: new Set(),
    buffers: new Set(),
    textures: new Set(),
  };
  const bitmaps = [];
  let references = 0,
    sequence = 0,
    shaderChecks = 0,
    ready = 0,
    aborted = 0,
    closedBitmaps = 0,
    textureUploads = 0,
    drawFailure = false;
  const created = (kind) => {
    const value = { id: ++sequence };
    live[kind].add(value);
    return value;
  };
  const gl = new Proxy(
    {
      getContextAttributes: () => ({ stencil: true }),
      createShader: () => created('shaders'),
      deleteShader: (value) => live.shaders.delete(value),
      createProgram: () => created('programs'),
      deleteProgram: (value) => live.programs.delete(value),
      createBuffer: () => created('buffers'),
      deleteBuffer: (value) => live.buffers.delete(value),
      createTexture: () => created('textures'),
      deleteTexture: (value) => live.textures.delete(value),
      getShaderParameter: () => failure !== 'shader' || ++shaderChecks !== 2,
      getProgramParameter: () => failure !== 'link',
      getShaderInfoLog: () => 'Injected fragment shader failure',
      getProgramInfoLog: () => 'Injected program link failure',
      getAttribLocation: () => 0,
      getUniformLocation: () => ({}),
      drawArrays: () => {
        if (drawFailure) throw new Error('Injected draw failure');
      },
      texImage2D: () => {
        textureUploads++;
        if (failure === 'texture-upload')
          throw new Error('Injected texture upload failure');
      },
    },
    {
      get: (target, key) =>
        key in target
          ? target[key]
          : /^[A-Z_0-9]+$/u.test(String(key))
            ? 1
            : () => {},
    },
  );
  const add = (target, name, callback) =>
    events.set(`${target}:${name}`, callback);
  const remove = (target, name) => events.delete(`${target}:${name}`);
  const canvas = {
    dataset: {},
    clientWidth: 390,
    clientHeight: 844,
    getContext: () => {
      if (failure === 'context-getter')
        throw new Error('Injected context failure');
      return gl;
    },
    addEventListener: (name, callback) => add('canvas', name, callback),
    removeEventListener: (name) => remove('canvas', name),
  };
  const observer = class {
    constructor() {
      observers.push(this);
      this.connected = true;
    }
    observe() {}
    unobserve() {}
    disconnect() {
      this.connected = false;
    }
  };
  const origin = {
    name: 'Seoul Station',
    longitude: 126.9707793,
    latitude: 37.5545547,
  };
  const orbit = {
    longitude: 127.5,
    latitude: 36,
    radius: 0.72,
    anchorX: 0.5225,
    anchorY: 0.515,
  };
  const loadedModule = { exports: {} };
  const context = {
    module: loadedModule,
    exports: loadedModule.exports,
    AbortController,
    performance: { now: () => 0 },
    devicePixelRatio: 3,
    setTimeout: (callback, delay) => {
      const id = ++sequence;
      timers.set(id, { callback, delay });
      return id;
    },
    clearTimeout: (id) => timers.delete(id),
    requestAnimationFrame: (callback) => {
      const id = ++sequence;
      frames.set(id, callback);
      return id;
    },
    cancelAnimationFrame: (id) => frames.delete(id),
    ResizeObserver: failure === 'resize-observer' ? undefined : observer,
    IntersectionObserver: observer,
    window: {
      addEventListener: (name, callback) => add('window', name, callback),
      removeEventListener: (name) => remove('window', name),
    },
    document: {
      hidden: false,
      addEventListener: (name, callback) => add('document', name, callback),
      removeEventListener: (name) => remove('document', name),
    },
    matchMedia: () => ({
      matches: false,
      addEventListener: (name, callback) => add('media', name, callback),
      removeEventListener: (name) => remove('media', name),
    }),
    createImageBitmap: async () => {
      const image = { width: 2048, height: 1024, close: () => closedBitmaps++ };
      return failure === 'late-bitmaps'
        ? new Promise((resolve) => bitmaps.push(() => resolve(image)))
        : image;
    },
    fetch: (url, { signal }) => {
      if (
        failure === 'success' ||
        failure === 'late-bitmaps' ||
        failure === 'texture-upload'
      ) {
        const path = String(url);
        if (path.endsWith('korea-10m.json'))
          return Promise.resolve({
            ok: true,
            json: async () => ({ countries: {} }),
          });
        if (path.endsWith('korea-lights.json'))
          return Promise.resolve({
            ok: true,
            json: async () => ({ clusters: [], lights: [] }),
          });
        if (path.endsWith('.json')) return Promise.resolve({ ok: false });
        return Promise.resolve({ ok: true, blob: async () => ({}) });
      }
      return new Promise((_resolve, reject) =>
        signal.addEventListener(
          'abort',
          () => {
            aborted++;
            reject(new Error('Aborted'));
          },
          { once: true },
        ),
      );
    },
    require: (id) =>
      id === 'react'
        ? {
            useEffect: (callback) => effects.push(callback),
            useRef: (initial) => ({
              current: references++ === 0 ? canvas : initial,
            }),
            useState: (initial) => [initial, () => {}],
          }
        : id === 'react/jsx-runtime'
          ? { jsx: () => null, jsxs: () => null }
          : id.includes('trip-origin')
            ? { DEFAULT_TRIP_ORIGIN: origin }
            : id.includes('site-path')
              ? { sitePath: (path) => path }
              : id.includes('planet-camera')
                ? {
                    ORBIT: orbit,
                    cameraForKorea: () => ({
                      ...orbit,
                      radius: 12,
                      anchorX: 0.5,
                    }),
                    interpolateCamera: (_start, target) => target,
                    projectLocation: () => ({ x: 0, y: 0, visible: false }),
                    lightStyleForZoom: () => ({
                      pointSize: 10,
                      strengthBoost: 0,
                    }),
                  }
                : id.includes('planet-telemetry')
                  ? { sceneDiagnostics: () => () => {} }
                  : {},
  };
  vm.runInNewContext(code, context);
  loadedModule.exports.PlanetCanvas({
    activityId: 'test',
    locationName: 'Test',
    longitude: null,
    latitude: null,
    intro: true,
    detailZoom: false,
    mapRoute: null,
    origin,
    onBrowseReady: () => ready++,
  });
  return {
    canvas,
    live,
    timers,
    frames,
    observers,
    events,
    mount() {
      for (const effect of effects) {
        const cleanup = effect();
        if (cleanup) cleanups.push(cleanup);
      }
    },
    unmount() {
      for (const cleanup of cleanups) cleanup();
    },
    loseContext() {
      events.get('canvas:webglcontextlost')?.({ preventDefault() {} });
    },
    beginFlight() {
      const entry = [...timers].find(([, timer]) => timer.delay === 2400);
      assert.ok(entry);
      timers.delete(entry[0]);
      entry[1].callback();
    },
    frame(now) {
      const entry = [...frames][0];
      assert.ok(entry);
      frames.delete(entry[0]);
      entry[1](now);
    },
    failNextDraw() {
      drawFailure = true;
    },
    finishBitmaps() {
      for (const resolve of bitmaps) resolve();
    },
    expireStartup() {
      const entry = [...timers].find(([, timer]) => timer.delay === 18000);
      assert.ok(entry, 'startup must have a finite18second deadline');
      timers.delete(entry[0]);
      entry[1].callback();
    },
    stats: () => ({
      ready,
      aborted,
      closedBitmaps,
      textureUploads,
      gpu: Object.values(live).reduce((sum, objects) => sum + objects.size, 0),
      observers: observers.filter((item) => item.connected).length,
      listeners: events.size,
      timers: timers.size,
      frames: frames.size,
    }),
  };
}

for (const failure of ['shader', 'link', 'resize-observer', 'context-getter']) {
  await test(`startup ${failure} failure releases rendering resources and never aborts the parent startup`, () => {
    const view = fixture(failure);
    assert.doesNotThrow(() => view.mount());
    assert.equal(view.canvas.dataset.renderer, 'unavailable');
    assert.ok(view.stats().ready > 0);
    assert.equal(
      view.stats().gpu +
        view.stats().observers +
        view.stats().listeners +
        view.stats().timers +
        view.stats().frames,
      0,
    );
    view.unmount();
    assert.equal(view.stats().gpu, 0);
  });
}

await test('a stalled startup releases its asset requests after18seconds and lets the parent continue', async () => {
  const view = fixture();
  view.mount();
  assert.equal(view.stats().ready, 0);
  view.expireStartup();
  await new Promise((resolve) => setImmediate(resolve));
  assert.equal(view.canvas.dataset.renderer, 'unavailable');
  assert.ok(view.stats().ready > 0);
  assert.equal(view.stats().aborted, 9);
  assert.equal(
    view.stats().gpu +
      view.stats().observers +
      view.stats().listeners +
      view.stats().timers +
      view.stats().frames,
    0,
  );
});

await test('context loss falls back once and unmount releases a still-loading scene without retaining work', async () => {
  const view = fixture();
  view.mount();
  view.loseContext();
  await new Promise((resolve) => setImmediate(resolve));
  assert.equal(view.canvas.dataset.renderer, 'unavailable');
  const ready = view.stats().ready;
  assert.ok(ready > 0);
  view.loseContext();
  view.unmount();
  assert.equal(view.stats().ready, ready);
  assert.equal(
    view.stats().gpu +
      view.stats().observers +
      view.stats().listeners +
      view.stats().timers +
      view.stats().frames,
    0,
  );
  const loading = fixture();
  loading.mount();
  loading.unmount();
  loading.unmount();
  await new Promise((resolve) => setImmediate(resolve));
  assert.equal(loading.stats().ready, 0);
  assert.equal(
    loading.stats().gpu +
      loading.stats().observers +
      loading.stats().listeners +
      loading.stats().timers +
      loading.stats().frames,
    0,
  );
});

await test('normal asset readiness clears the startup deadline and preserves the existing orbit-to-country flight', async () => {
  const view = fixture('success');
  view.mount();
  await new Promise((resolve) => setImmediate(resolve));
  assert.equal(view.canvas.dataset.renderer, 'ready');
  assert.equal(view.canvas.dataset.phase, 'orbit');
  assert.equal(view.stats().closedBitmaps, 4);
  assert.equal(
    [...view.timers.values()].some((timer) => timer.delay === 18000),
    false,
  );
  assert.deepEqual(
    [view.live.buffers.size, view.live.programs.size, view.live.textures.size],
    [10, 5, 4],
  );
  view.beginFlight();
  view.frame(5600);
  assert.equal(view.canvas.dataset.phase, 'korea');
  assert.ok(view.stats().ready > 0);
  view.unmount();
  assert.equal(
    view.stats().gpu +
      view.stats().observers +
      view.stats().listeners +
      view.stats().timers +
      view.stats().frames,
    0,
  );
});

await test('a later draw exception falls back without scheduling another animation frame or ambient tick', async () => {
  const view = fixture('success');
  view.mount();
  await new Promise((resolve) => setImmediate(resolve));
  assert.equal(view.canvas.dataset.renderer, 'ready');
  view.beginFlight();
  view.failNextDraw();
  view.frame(1000);
  assert.equal(view.canvas.dataset.renderer, 'unavailable');
  assert.equal(view.canvas.dataset.startupFailure, 'rendering');
  assert.ok(view.stats().ready > 0);
  assert.equal(
    view.stats().gpu +
      view.stats().observers +
      view.stats().listeners +
      view.stats().timers +
      view.stats().frames,
    0,
  );
});

await test('bitmaps decoded after the startup deadline are closed without uploading into a disposed context', async () => {
  const view = fixture('late-bitmaps');
  view.mount();
  await new Promise((resolve) => setImmediate(resolve));
  view.expireStartup();
  view.finishBitmaps();
  await new Promise((resolve) => setImmediate(resolve));
  assert.equal(view.canvas.dataset.renderer, 'unavailable');
  assert.equal(view.stats().closedBitmaps, 4);
  assert.equal(view.stats().textureUploads, 0);
  assert.equal(
    view.stats().gpu +
      view.stats().observers +
      view.stats().listeners +
      view.stats().timers +
      view.stats().frames,
    0,
  );
});

await test('a texture upload exception closes every decoded bitmap before falling back', async () => {
  const view = fixture('texture-upload');
  view.mount();
  await new Promise((resolve) => setImmediate(resolve));
  assert.equal(view.canvas.dataset.renderer, 'unavailable');
  assert.equal(view.stats().closedBitmaps, 4);
  assert.ok(view.stats().ready > 0);
  assert.equal(
    view.stats().gpu +
      view.stats().observers +
      view.stats().listeners +
      view.stats().timers +
      view.stats().frames,
    0,
  );
});
