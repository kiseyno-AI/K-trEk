import { runtimeTripCommunityHandlers } from '../../../lib/trip-community-store';

export const dynamic = 'force-dynamic';
async function handle(request: Request) {
  try {
    return await (await runtimeTripCommunityHandlers()).reports(request);
  } catch {
    return Response.json(
      { error: 'Reports are temporarily unavailable. Please try again.' },
      { status: 503, headers: { 'Cache-Control': 'no-store' } },
    );
  }
}
export const GET = handle;
export const POST = handle;
export const PATCH = handle;
