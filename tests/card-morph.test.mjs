import assert from 'node:assert/strict';
import test from 'node:test';
import { morphCard, flyCards } from '../lib/card-morph.ts';

function element(rect) {
  return {
    style: {},
    calls: [],
    getBoundingClientRect: () => rect,
    animate(frames, options) {
      this.calls.push({ frames, options });
      return { finished: Promise.resolve() };
    },
  };
}

void test('cards enter from beyond the right edge and leave completely to the right before replacement', () => {
  const original = globalThis.getComputedStyle;
  globalThis.getComputedStyle = () => ({ opacity: '0.8' });
  try {
    const card = element({ left: 450, top: 250, width: 380, height: 360 });
    flyCards([card], 'enter', 1280);
    assert.equal(card.calls[0].frames[0].translate, '878px 12px');
    assert.equal(card.calls[0].frames.at(-1).translate, '0 0');
    assert.equal(card.calls[0].frames.at(-1).opacity, '0.8');
    flyCards([card], 'exit', 1280);
    assert.equal(card.calls[1].frames[0].translate, '0 0');
    assert.equal(card.calls[1].frames.at(-1).translate, '878px 12px');
    assert.equal(card.calls[1].frames.at(-1).opacity, 0);
    assert.equal(card.calls[1].options.fill, 'forwards');
  } finally {
    globalThis.getComputedStyle = original;
  }
});

void test('a card photo reaches its actual destination frame while live detail text is never scaled', () => {
  const surface = element({});
  const photo = element({});
  const copy = element({});
  const target = element({ left: 640, top: 140, width: 600, height: 540 });
  const targetPhoto = element({ left: 640, top: 140, width: 600, height: 240 });
  target.querySelector = (selector) =>
    selector === '.detail-image'
      ? targetPhoto
      : element({ left: 670, top: 470 });
  const animations = morphCard(surface, photo, copy, target, {
    card: { left: 400, top: 200, width: 380, height: 360 },
    photo: { left: 400, top: 200, width: 380, height: 150 },
    copy: { left: 400, top: 350, width: 380, height: 210 },
    title: { left: 422, top: 380, width: 336, height: 28 },
  });
  assert.equal(animations.length, 4);
  assert.deepEqual(
    ['left', 'top', 'width', 'height'].map(
      (key) => photo.calls[0].frames[0][key],
    ),
    ['400px', '200px', '380px', '150px'],
  );
  assert.deepEqual(
    ['left', 'top', 'width', 'height'].map(
      (key) => photo.calls[0].frames.at(-1)[key],
    ),
    ['640px', '140px', '600px', '240px'],
  );
  assert.equal(surface.calls[0].frames.at(-1).opacity, 0);
  assert.equal(photo.calls[0].frames.at(-1).opacity, 0);
  assert.ok(
    target.calls[0].frames.every(
      (frame) => !('transform' in frame) && !('scale' in frame),
    ),
  );
  assert.equal(target.calls[0].frames.at(-1).opacity, 1);
  assert.ok(
    copy.calls[0].frames.every((frame) => !frame.transform?.includes('scale')),
  );
  assert.equal(copy.calls[0].frames.at(-1).transform, 'translate(248px, 90px)');
  assert.equal(
    target.calls[0].frames[1].offset,
    photo.calls[0].frames[1].offset,
  );
});

void test('missing or unmeasurable destinations keep the normal detail immediately available', () => {
  const surface = element({});
  const photo = element({});
  const copy = element({});
  const target = element({ left: 0, top: 0, width: 0, height: 0 });
  target.querySelector = () => null;
  assert.deepEqual(
    morphCard(surface, photo, copy, target, {
      card: { left: 0, top: 0, width: 380, height: 360 },
      photo: { left: 0, top: 0, width: 380, height: 150 },
      copy: { left: 0, top: 150, width: 380, height: 210 },
      title: { left: 22, top: 180, width: 336, height: 28 },
    }),
    [],
  );
  assert.equal(
    surface.calls.length + photo.calls.length + target.calls.length,
    0,
  );
});

void test('a short panel clips the travelling source title instead of drawing it below the visible panel', () => {
  const surface = element({});
  const photo = element({});
  const copy = element({});
  const target = element({ left: 18, top: 281, width: 284, height: 263 });
  target.querySelector = (selector) =>
    element(
      selector === '.detail-image'
        ? { left: 18, top: 281, width: 284, height: 180 }
        : { left: 40, top: 579 },
    );
  morphCard(surface, photo, copy, target, {
    card: { left: 29, top: 257, width: 262, height: 222 },
    photo: { left: 29, top: 257, width: 262, height: 90 },
    copy: Object.create({ left: 29, top: 347, width: 262, height: 132 }),
    title: { left: 45, top: 409, width: 230, height: 22 },
  });
  assert.equal(copy.calls[0].frames[0].clipPath, 'inset(0px 0px 0px 0px)');
  assert.equal(
    copy.calls[0].frames.at(-1).clipPath,
    'inset(0px 0px 105px 0px)',
  );
});
