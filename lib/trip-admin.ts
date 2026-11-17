import { authenticateRequest } from './trip-auth-store';

export async function canEditActivities(
  request: Pick<Request, 'url' | 'headers'>,
): Promise<boolean> {
  return (await authenticateRequest(request))?.role === 'admin';
}
