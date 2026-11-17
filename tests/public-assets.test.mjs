import assert from 'node:assert/strict';
import test from 'node:test';
import { createServer } from 'node:http';
import { once } from 'node:events';
import { checkPublicAssets } from '../scripts/check-public-assets.mjs';

async function serve(t, assetStatus = 200, contentType = 'text/css') {
  const server = createServer((request, response) => {
    if (request.url === '/ktravel') {
      response.writeHead(200, { 'Content-Type': 'text/html' });
      response.end(
        '<link rel="stylesheet" href="/ktravel/site.css"><script src="/ktravel/app.js"></script>',
      );
    } else {
      response.writeHead(assetStatus, {
        'Content-Type': request.url.endsWith('.js')
          ? 'application/javascript'
          : contentType,
      });
      response.end('fixture');
    }
  });
  server.listen(0, '127.0.0.1');
  await once(server, 'listening');
  t.after(() => {
    server.closeAllConnections();
    return new Promise((resolve) => server.close(resolve));
  });
  return `http://127.0.0.1:${server.address().port}/ktravel`;
}

void test('the public asset gate rejects a styled-page shell whose referenced stylesheet is unavailable', async (t) => {
  await assert.rejects(
    checkPublicAssets(await serve(t, 404)),
    /site\.css: HTTP 404/,
  );
});

void test('a 200 HTML fallback cannot masquerade as CSS', async (t) => {
  await assert.rejects(
    checkPublicAssets(await serve(t, 200, 'text/html')),
    /wrong content type/,
  );
});

void test('a page and its own CSS/JS must all be available with correct MIME', async (t) => {
  const result = await checkPublicAssets(await serve(t));
  assert.equal(result.assets, 2);
});
