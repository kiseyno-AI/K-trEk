import { createTripAuthHandlers } from '../../../lib/trip-auth';
import { runtimeTripAuthStore } from '../../../lib/trip-auth-store';

export const dynamic = 'force-dynamic';
async function handle(request: Request) {
  try {
    return await createTripAuthHandlers(await runtimeTripAuthStore()).session(
      request,
    );
  } catch {
    return Response.json(
      { error: 'Sign-in is temporarily unavailable. Please try again.' },
      { status: 503, headers: { 'Cache-Control': 'no-store' } },
    );
  }
}
export const GET = handle;
export const POST = handle;
export const DELETE = handle;
