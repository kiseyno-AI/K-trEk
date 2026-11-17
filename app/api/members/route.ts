import { runtimeTripCommunityHandlers } from '../../../lib/trip-community-store';

export const dynamic = 'force-dynamic';
export async function GET(request: Request) {
  try {
    return await (await runtimeTripCommunityHandlers()).members(request);
  } catch {
    return Response.json(
      { error: 'Members are temporarily unavailable. Please try again.' },
      { status: 503, headers: { 'Cache-Control': 'no-store' } },
    );
  }
}
