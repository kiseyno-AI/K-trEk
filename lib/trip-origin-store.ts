import { env } from 'cloudflare:workers';
import { configuredTripOrigin } from './trip-origin.ts';

export function getTripOrigin() {
  return configuredTripOrigin(
    (env as { TRIP_ORIGIN_JSON?: string }).TRIP_ORIGIN_JSON,
  );
}
