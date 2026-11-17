export function localTripVoiceAvailable(headers: Pick<Headers, 'get'>) {
  if (process.env.NODE_ENV === 'production') return false;
  const host = headers.get('x-forwarded-host') || headers.get('host') || '';
  return /^(localhost|127\.0\.0\.1|\[::1\])(?::\d{1,5})?$/i.test(host);
}
