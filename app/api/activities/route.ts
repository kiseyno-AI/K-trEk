import { parseActivity } from '../../../lib/activities';
import {
  createActivity,
  listActivities,
  listActivityRecords,
} from '../../../lib/activity-store';
import { readAdminJson } from '../../../lib/admin-access';
import { canEditActivities } from '../../../lib/trip-admin';

export const dynamic = 'force-dynamic';
const headers = { 'Cache-Control': 'no-store' };

export async function GET(request: Request) {
  try {
    if (new URL(request.url).searchParams.get('admin') === '1') {
      if (!(await canEditActivities(request)))
        return Response.json(
          { error: 'Admin access is required.' },
          { status: 403, headers },
        );
      return Response.json(
        { activities: await listActivityRecords() },
        { headers },
      );
    }
    return Response.json({ activities: await listActivities() }, { headers });
  } catch {
    return Response.json(
      {
        error: 'Activity database is not ready. Run the local database setup.',
      },
      { status: 503, headers },
    );
  }
}
export async function POST(request: Request) {
  if (!(await canEditActivities(request)))
    return Response.json(
      { error: 'Admin access is required.' },
      { status: 403, headers },
    );
  let input;
  try {
    input = parseActivity(await readAdminJson(request));
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
    return Response.json(
      { activity: await createActivity(input) },
      { status: 201, headers },
    );
  } catch (error) {
    const duplicate =
      error instanceof Error &&
      /UNIQUE constraint|PRIMARY KEY/i.test(error.message);
    return Response.json(
      {
        error: duplicate
          ? 'This card ID already exists.'
          : 'The activity could not be saved.',
      },
      { status: duplicate ? 409 : 503, headers },
    );
  }
}
