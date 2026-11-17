import { env } from 'cloudflare:workers';
import { authenticateRequest } from '../../../lib/trip-auth-store';
import { findActivity } from '../../../lib/activity-store';
import { getTripOrigin } from '../../../lib/trip-origin-store';
import { createKakaoDirectionsHandler } from '../../../lib/kakao-directions';

export const dynamic = 'force-dynamic';

const handle = createKakaoDirectionsHandler({
  findActivity,
  getOrigin: getTripOrigin,
  getApiKey: () =>
    (env as { KAKAO_MOBILITY_REST_API_KEY?: string })
      .KAKAO_MOBILITY_REST_API_KEY,
});

export async function GET(
  request: Request,
  context: { params: Promise<{ id: string }> },
) {
  if (!(await authenticateRequest(request)))
    return Response.json(
      { error: 'Sign in to view routes.' },
      { status: 401, headers: { 'Cache-Control': 'no-store' } },
    );
  const { id } = await context.params;
  return handle(request, id);
}
