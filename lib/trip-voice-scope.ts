export function localTripVoiceAvailable(headers: Pick<Headers, 'get'>) {
  const host = headers.get('x-forwarded-host') || headers.get('host') || '';
  return /^(localhost|127\.0\.0\.1|\[::1\])(?::\d{1,5})?$/i.test(host);
}
