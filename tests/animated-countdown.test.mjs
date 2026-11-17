import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';
import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import ts from 'typescript';

async function renderCountdown(value, active = true) {
  const source = await readFile(
    new URL('../app/animated-countdown.tsx', import.meta.url),
    'utf8',
  );
  const compiled = ts
    .transpileModule(source, {
      compilerOptions: {
        jsx: ts.JsxEmit.ReactJSX,
        module: ts.ModuleKind.ESNext,
        target: ts.ScriptTarget.ES2017,
      },
    })
    .outputText.replace(
      /import styles from ['"][^'"]+\.css['"];?/,
      'const styles = {};',
    )
    .replace(
      /from ['"]([^'"]+)['"]/g,
      (_, specifier) =>
        `from ${JSON.stringify(import.meta.resolve(specifier))}`,
    );
  const { AnimatedCountdown } = await import(
    `data:text/javascript;base64,${Buffer.from(`${compiled}\n//# sourceURL=animated-countdown.test-compiled.js`).toString('base64')}`
  );
  return renderToStaticMarkup(
    createElement(AnimatedCountdown, {
      value,
      active,
      dateTime: '2027-01-16T04:59:59Z',
    }),
  );
}

void test('the animated clock keeps a complete semantic time and hides decorative digits from assistive technology', async () => {
  const html = await renderCountdown('1452:34:56');
  assert.match(html, /<time[^>]+dateTime="2027-01-16T04:59:59Z"/);
  assert.match(html, /aria-label="1452:34:56"/);
  assert.match(html, /aria-hidden="true"/);
  assert.match(html, /HOURS/);
  assert.match(html, /MINUTES/);
  assert.match(html, /SECONDS/);
  assert.equal((html.match(/data-countdown-digit=/g) ?? []).length, 8);
  assert.equal((html.match(/<svg/g) ?? []).length, 8);
  assert.doesNotMatch(html, /aria-live/);
});

void test('inactive and expired clocks render their actual final value without requiring animation', async () => {
  const html = await renderCountdown('00:00:00', false);
  assert.match(html, /aria-label="00:00:00"/);
  assert.equal((html.match(/data-countdown-digit=/g) ?? []).length, 6);
  assert.doesNotMatch(html, /days|day/);
});
