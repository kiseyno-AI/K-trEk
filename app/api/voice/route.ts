import { env } from 'cloudflare:workers';
import { findActivity } from '../../../lib/activity-store';
import { runtimeTripAuthStore } from '../../../lib/trip-auth-store';
import { createTripVoiceHandler } from '../../../lib/trip-voice';
import { localTripVoiceAvailable } from '../../../lib/trip-voice-scope';
import { runtimeTripAssistantStore } from '../../../lib/trip-assistant-store';

export const dynamic = 'force-dynamic';
const handle = createTripVoiceHandler({
  getStore: runtimeTripAuthStore,
  findAssistantMessage: async (userId, messageId) =>
    (await runtimeTripAssistantStore()).message(userId, messageId),
  findActivity: async (id) => {
    const activity = await findActivity(id);
    return activity
      ? { published: activity.published, title: activity.name_en }
      : null;
  },
  getConfig: () => {
    const settings = env as {
      ELEVENLABS_API_KEY?: string;
      ELEVENLABS_VOICE_ID?: string;
      OPENCLAW_GATEWAY_TOKEN?: string;
    };
    return {
      elevenLabsApiKey: settings.ELEVENLABS_API_KEY,
      voiceId: settings.ELEVENLABS_VOICE_ID,
      gatewayToken: settings.OPENCLAW_GATEWAY_TOKEN,
    };
  },
});
const localHandle = (request: Request) =>
  localTripVoiceAvailable(request.headers)
    ? handle(request)
    : new Response(null, { status: 404 });
export const GET = localHandle;
export const HEAD = localHandle;
export const POST = localHandle;
