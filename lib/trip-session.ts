import { sitePath } from './site-path.ts';
import type { TripUser } from './trip-auth';

export async function readTripSession(
  signal: AbortSignal,
): Promise<TripUser | null> {
  if (signal.aborted) return null;
  const request = new AbortController();
  const abort = () => request.abort();
  signal.addEventListener('abort', abort, { once: true });
  const timeout = setTimeout(abort, 6000);
  try {
    const response = await fetch(sitePath('/api/session'), {
      signal: request.signal,
      cache: 'no-store',
    });
    const result = (await response.json()) as { user?: TripUser | null };
    return response.ok ? (result.user ?? null) : null;
  } catch {
    return null;
  } finally {
    clearTimeout(timeout);
    signal.removeEventListener('abort', abort);
  }
}
