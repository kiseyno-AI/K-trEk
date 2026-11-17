import { tripRequestOrigin } from './trip-auth.ts';

export function adminAllowed(
  request: Pick<Request, 'url' | 'headers'>,
  settings: { development: boolean; emails?: string },
): boolean {
  const hostname = new URL(request.url).hostname;
  if (
    settings.development &&
    ['localhost', '127.0.0.1', '[::1]'].includes(hostname)
  )
    return true;
  const email = request.headers
    .get('oai-authenticated-user-email')
    ?.trim()
    .toLowerCase();
  const userId = request.headers.get('oai-authenticated-user-id');
  const allowed = (settings.emails || '')
    .split(',')
    .map((value) => value.trim().toLowerCase())
    .filter(Boolean);
  return Boolean(userId && email && allowed.includes(email));
}

export async function readAdminJson(request: Request): Promise<unknown> {
  const origin = request.headers.get('origin');
  if (origin && origin !== tripRequestOrigin(request))
    throw new Error('Cross-origin writes are not allowed.');
  if (
    !request.headers
      .get('content-type')
      ?.toLowerCase()
      .startsWith('application/json')
  )
    throw new Error('Send application/json.');
  if (Number(request.headers.get('content-length')) > 65536)
    throw new Error('Activity payload is too large.');
  const reader = request.body?.getReader();
  if (!reader) throw new Error('Activity data is required.');
  let size = 0;
  const parts: Uint8Array[] = [];
  while (true) {
    const part = await reader.read();
    if (part.done) break;
    size += part.value.byteLength;
    if (size > 65536) {
      await reader.cancel();
      throw new Error('Activity payload is too large.');
    }
    parts.push(part.value);
  }
  const buffer = new Uint8Array(size);
  let offset = 0;
  for (const part of parts) {
    buffer.set(part, offset);
    offset += part.byteLength;
  }
  try {
    return JSON.parse(new TextDecoder().decode(buffer));
  } catch {
    throw new Error('Activity data must be valid JSON.');
  }
}
