import { createTripAuthHandlers } from '../../../../lib/trip-auth';
import { runtimeTripAuthStore } from '../../../../lib/trip-auth-store';

export const dynamic = 'force-dynamic';
export async function POST(request: Request) {
  try {
    return await createTripAuthHandlers(await runtimeTripAuthStore()).name(
      request,
    );
  } catch {
    return Response.json(
      { error: 'Sign-in is temporarily unavailable. Please try again.' },
      { status: 503, headers: { 'Cache-Control': 'no-store' } },
    );
  }
}
