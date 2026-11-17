import { env } from 'cloudflare:workers';
import { createTripAssistantHandler } from '../../../lib/trip-assistant';
import { runtimeTripAssistantStore } from '../../../lib/trip-assistant-store';
import { authenticateRequest } from '../../../lib/trip-auth-store';

export const dynamic = 'force-dynamic';
export const POST = createTripAssistantHandler({
  getStore: runtimeTripAssistantStore,
  authenticate: authenticateRequest,
  getConfig: () => {
    const settings = env as {
      OPENCLAW_GATEWAY_TOKEN?: string;
      OPENCLAW_TRIP_ASSISTANT_ISOLATED?: string;
    };
    return {
      gatewayToken: settings.OPENCLAW_GATEWAY_TOKEN,
      assistantIsolated: settings.OPENCLAW_TRIP_ASSISTANT_ISOLATED === 'true',
    };
  },
});
