import { parseActivity } from '../../../../lib/activities';
import { updateActivity } from '../../../../lib/activity-store';
import { readAdminJson } from '../../../../lib/admin-access';
import { canEditActivities } from '../../../../lib/trip-admin';

export const dynamic = 'force-dynamic';
export async function PUT(
  request: Request,
  context: { params: Promise<{ id: string }> },
) {
  const headers = { 'Cache-Control': 'no-store' };
  if (!(await canEditActivities(request)))
    return Response.json(
      { error: 'Admin access is required.' },
      { status: 403, headers },
    );
  const { id } = await context.params;
  let input;
  try {
    input = parseActivity(await readAdminJson(request));
    if (input.id !== id)
      throw new Error('The card ID cannot change during an update.');
  } catch (error) {
    return Response.json(
      {
        error:
          error instanceof Error ? error.message : 'Invalid activity data.',
      },
      { status: 400, headers },
    );
  }
  try {
    const activity = await updateActivity(id, input);
    return activity
      ? Response.json({ activity }, { headers })
      : Response.json(
          { error: 'This card no longer exists.' },
          { status: 404, headers },
        );
  } catch {
    return Response.json(
      { error: 'The activity could not be saved.' },
      { status: 503, headers },
    );
  }
}
