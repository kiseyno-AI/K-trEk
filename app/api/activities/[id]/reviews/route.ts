import { runtimeTripCommunityHandlers } from '../../../../../lib/trip-community-store';

export const dynamic = 'force-dynamic';
export async function PATCH(
  request: Request,
  context: { params: Promise<{ id: string }> },
) {
  try {
    const { id } = await context.params;
    return await (await runtimeTripCommunityHandlers()).reviews(request, id);
  } catch {
    return Response.json(
      { error: 'Reviews are temporarily unavailable. Please try again.' },
      { status: 503, headers: { 'Cache-Control': 'no-store' } },
    );
  }
}
