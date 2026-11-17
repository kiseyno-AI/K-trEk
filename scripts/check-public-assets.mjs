import assert from 'node:assert/strict';
import { pathToFileURL } from 'node:url';

export async function checkPublicAssets(base, fetchAsset = fetch) {
  const page = new URL(base);
  const response = await fetchAsset(page, {
    cache: 'no-store',
    signal: AbortSignal.timeout(12000),
  });
  assert.equal(response.status, 200, `Page returned HTTP ${response.status}`);
  assert.match(response.headers.get('content-type') ?? '', /text\/html/i);
  const html = await response.text();
  const assets = new Map();
  for (const tag of html.match(/<(?:link|script)\b[^>]*>/gi) ?? []) {
    const attribute = tag.match(/\b(?:href|src)\s*=\s*(["'])(.*?)\1/i)?.[2];
    if (!attribute) continue;
    const url = new URL(attribute.replaceAll('&amp;', '&'), page);
    if (url.origin !== page.origin || !/\.(?:css|js)$/.test(url.pathname))
      continue;
    assets.set(url.href, url.pathname.endsWith('.css') ? 'css' : 'js');
  }
  assert.ok([...assets.values()].includes('css'), 'Page has no stylesheet');
  assert.ok(
    [...assets.values()].includes('js'),
    'Page has no JavaScript entry',
  );
  for (const [url, type] of assets) {
    const asset = await fetchAsset(url, {
      cache: 'no-store',
      signal: AbortSignal.timeout(12000),
    });
    try {
      assert.equal(
        asset.status,
        200,
        `${new URL(url).pathname}: HTTP ${asset.status}`,
      );
      assert.match(
        asset.headers.get('content-type') ?? '',
        type === 'css' ? /text\/css/i : /(?:application|text)\/javascript/i,
        `${url}: wrong content type`,
      );
    } finally {
      await asset.body?.cancel();
    }
  }
  return { origin: page.origin, assets: assets.size };
}

if (
  process.argv[1] &&
  import.meta.url === pathToFileURL(process.argv[1]).href
) {
  for (const base of [
    'http://127.0.0.1:4330/ktravel',
    'https://shawnai.win/ktravel',
  ]) {
    const result = await checkPublicAssets(base);
    console.log(`${result.origin}: ${result.assets} CSS/JS assets passed`);
  }
}
