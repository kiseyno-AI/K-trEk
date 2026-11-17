import test from 'node:test';
import assert from 'node:assert/strict';
import { fileURLToPath } from 'node:url';
import { build } from 'esbuild';
import { Miniflare } from 'miniflare';

await test('the voice HTTP handler generates an MP3 using native Worker requests', async () => {
  const result = await build({
    stdin: {
      resolveDir: fileURLToPath(new URL('../', import.meta.url)),
      contents: `
        import { createTripVoiceHandler } from './lib/trip-voice.ts';
        const handle = createTripVoiceHandler({
          getStore: async () => ({
            sessionUser: async () => ({ id: 'fixture', name: 'Brenda', role: 'member' }),
            consumeLimit: async () => 1,
          }),
          getConfig: () => ({ elevenLabsApiKey: 'fixture-key', gatewayToken: 'fixture-token', voiceId: 'JBFqnCBsd6RMkjVDRZzb' }),
          findActivity: async () => null,
          fetch: async (url, init) => {
            // Native validation catches runtime differences hidden by Node-only fetch mocks.
            const request = new Request(url, init);
            if (request.url.includes('/v1/responses')) return Response.json({
              status: 'completed',
              output: [{ type: 'message', role: 'assistant', status: 'completed', content: [{ type: 'output_text', text: 'Welcome, Brenda!' }] }],
            });
            return new Response(new Uint8Array([0x49, 0x44, 0x33, 1]), { headers: { 'Content-Type': 'audio/mpeg' } });
          },
        });
        export default { fetch: handle };
      `,
    },
    bundle: true,
    platform: 'neutral',
    format: 'esm',
    external: ['node:*'],
    write: false,
  });
  const worker = new Miniflare({
    modules: true,
    compatibilityDate: '2026-05-15',
    compatibilityFlags: ['nodejs_compat'],
    script: result.outputFiles[0].text,
  });
  try {
    const response = await worker.dispatchFetch(
      'https://shawnai.win/ktravel/api/voice',
      {
        method: 'POST',
        headers: {
          Origin: 'https://shawnai.win',
          'Content-Type': 'application/json',
          Cookie: `ktravel_session=${'a'.repeat(64)}`,
        },
        body: JSON.stringify({ event: 'greeting' }),
      },
    );
    assert.equal(response.status, 200);
    assert.equal(response.headers.get('content-type'), 'audio/mpeg');
    assert.equal(response.headers.get('x-trip-voice-source'), 'openclaw');
    assert.equal(
      response.headers.get('x-trip-voice-text'),
      'Welcome%2C%20Brenda!',
    );
    assert.deepEqual(
      [...new Uint8Array(await response.arrayBuffer())],
      [0x49, 0x44, 0x33, 1],
    );
  } finally {
    await worker.dispose();
  }
});
