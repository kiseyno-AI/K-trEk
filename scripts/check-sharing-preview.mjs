import assert from 'node:assert/strict';

const canonical = 'https://shawnai.win/ktravel';
const image = `${canonical}/trip/korea-night-map.png`;

for (const page of process.argv.slice(2).length
  ? process.argv.slice(2)
  : ['http://127.0.0.1:4330/ktravel', canonical]) {
  const response = await fetch(page, {
    headers: { 'User-Agent': 'KTravel link preview verification/1.0' },
    cache: 'no-store',
    signal: AbortSignal.timeout(15000),
  });
  assert.equal(response.status, 200);
  const html = await response.text();
  const meta = new Map();
  for (const [tag] of html.matchAll(/<meta\b[^>]*>/gi)) {
    const name = tag.match(/\b(?:name|property)="([^"]*)"/i)?.[1];
    const content = tag.match(/\bcontent="([^"]*)"/i)?.[1];
    if (name && content) meta.set(name, content.replaceAll('&amp;', '&'));
  }
  for (const key of ['og:title', 'twitter:title'])
    assert.equal(meta.get(key), 'K-trEk, without Shawn & Sun');
  for (const key of ['og:image', 'twitter:image'])
    assert.equal(meta.get(key), image, `${key} must use the Korea trip image`);
  assert.equal(meta.get('og:url'), canonical);
  assert.match(
    html,
    /<link\b(?=[^>]*rel="canonical")(?=[^>]*href="https:\/\/shawnai\.win\/ktravel")[^>]*>/i,
  );
  assert.doesNotMatch(
    [...meta.values()].join('\n'),
    /new york|뉴욕|k-scene|events-nyc|chatgpt\.site/i,
  );
  const preview = await fetch(image, { signal: AbortSignal.timeout(15000) });
  assert.equal(preview.status, 200);
  assert.match(preview.headers.get('content-type') ?? '', /image\/png/i);
  const bytes = Buffer.from(await preview.arrayBuffer());
  assert.equal(bytes.subarray(0, 8).toString('hex'), '89504e470d0a1a0a');
  assert.ok(bytes.length < 5 * 1024 * 1024);
  assert.equal(meta.get('og:image:width'), String(bytes.readUInt32BE(16)));
  assert.equal(meta.get('og:image:height'), String(bytes.readUInt32BE(20)));
  console.log(
    `${new URL(page).host}: K-trEk sharing metadata and Korea image passed`,
  );
}
