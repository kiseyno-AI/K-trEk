import assert from 'node:assert/strict';
import test from 'node:test';
import {
  mkdtemp,
  mkdir,
  writeFile,
  readFile,
  rm,
  readdir,
} from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { createServer } from 'node:http';
import { once } from 'node:events';
import { releasePublic } from '../scripts/release-public.mjs';
import { checkPublicAssets } from '../scripts/check-public-assets.mjs';

async function fixture(t) {
  const root = await mkdtemp(join(tmpdir(), 'ktravel-release-test-'));
  t.after(() => rm(root, { recursive: true, force: true }));
  const staticPath = join(root, 'dist/client/ktravel/_next/static');
  const build = async (version) => {
    await rm(join(root, 'dist'), { recursive: true, force: true });
    await mkdir(staticPath, { recursive: true });
    await mkdir(join(root, 'dist/client/.vite'), { recursive: true });
    for (const file of [`${version}.js`, `${version}.css`, 'common.js'])
      await writeFile(join(staticPath, file), `${version}:${file}`);
    await writeFile(
      join(root, 'dist/client/.vite/manifest.json'),
      JSON.stringify({
        main: {
          file: `ktravel/_next/static/${version}.js`,
          css: [`ktravel/_next/static/${version}.css`],
        },
        common: { file: 'ktravel/_next/static/common.js' },
      }),
    );
  };
  await build('old');
  await writeFile(
    join(staticPath, 'ancient.js'),
    'not in the previous fresh manifest',
  );
  let snapshot = new Set(await readdir(staticPath));
  let version = 'old';
  const server = createServer(async (request, response) => {
    if (request.url === '/ktravel') {
      response.writeHead(200, { 'Content-Type': 'text/html' });
      response.end(
        `<link rel="stylesheet" href="/ktravel/_next/static/${version}.css"><script src="/ktravel/_next/static/${version}.js"></script>`,
      );
    } else {
      const file = request.url.split('/').at(-1);
      response.writeHead(snapshot.has(file) ? 200 : 404, {
        'Content-Type': file.endsWith('.css')
          ? 'text/css'
          : 'application/javascript',
      });
      response.end(
        snapshot.has(file) ? await readFile(join(staticPath, file)) : 'missing',
      );
    }
  });
  server.listen(0, '127.0.0.1');
  await once(server, 'listening');
  t.after(() => {
    server.closeAllConnections();
    return new Promise((resolve) => server.close(resolve));
  });
  const base = `http://127.0.0.1:${server.address().port}/ktravel`;
  const operations = {
    stop: async () => {
      snapshot = new Set();
    },
    build: async () => {
      await build('new');
      version = 'new';
    },
    start: async () => {
      snapshot = new Set(await readdir(staticPath));
      version = snapshot.has('new.css') ? 'new' : 'old';
    },
    check: () => checkPublicAssets(base),
  };
  return { root, staticPath, base, operations };
}

void test('release serves the new build and the previous fresh assets for already-open tabs', async (t) => {
  const f = await fixture(t);
  await releasePublic(f.root, f.operations);
  for (const file of ['old.css', 'old.js', 'new.css', 'new.js'])
    assert.equal(
      (await fetch(`${f.base}/_next/static/${file}`)).status,
      200,
      file,
    );
  assert.equal((await fetch(`${f.base}/_next/static/ancient.js`)).status, 404);
  assert.equal(
    await readFile(join(f.staticPath, 'common.js'), 'utf8'),
    'new:common.js',
  );
});

void test('a failed build restores the previous complete build and starts it again', async (t) => {
  const f = await fixture(t);
  f.operations.build = async () => {
    await rm(join(f.root, 'dist'), { recursive: true });
    throw new Error('build failed');
  };
  await assert.rejects(
    releasePublic(f.root, f.operations),
    /previous build restored/,
  );
  assert.equal((await fetch(`${f.base}/_next/static/old.css`)).status, 200);
  await checkPublicAssets(f.base);
});

void test('a failed CSS gate rolls back instead of declaring an unstyled deployment successful', async (t) => {
  const f = await fixture(t);
  f.operations.check = async () => {
    throw new Error('new CSS404');
  };
  await assert.rejects(
    releasePublic(f.root, f.operations),
    /previous build restored/,
  );
  assert.equal((await fetch(`${f.base}/_next/static/old.js`)).status, 200);
  await checkPublicAssets(f.base);
});

void test('a runtime recovery failure keeps the known previous build backup', async (t) => {
  const f = await fixture(t);
  f.operations.start = async () => {
    throw new Error('service cannot start');
  };
  await assert.rejects(
    releasePublic(f.root, f.operations),
    /previous build retained/,
  );
  const backups = (await readdir(join(f.root, '.wrangler'))).filter((name) =>
    name.startsWith('public-release-'),
  );
  assert.equal(backups.length, 1);
  assert.equal(
    await readFile(
      join(
        f.root,
        '.wrangler',
        backups[0],
        'dist/client/ktravel/_next/static/old.css',
      ),
      'utf8',
    ),
    'old:old.css',
  );
});
