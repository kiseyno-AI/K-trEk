import { runtimeTripCommunityHandlers } from '../../../lib/trip-community-store';

export const dynamic = 'force-dynamic';
async function handle(request: Request) {
  try {
    return await (await runtimeTripCommunityHandlers()).preferences(request);
  } catch {
    return Response.json(
      { error: 'Preferences are temporarily unavailable. Please try again.' },
      { status: 503, headers: { 'Cache-Control': 'no-store' } },
    );
  }
}
export const GET = handle;
export const PUT = handle;
