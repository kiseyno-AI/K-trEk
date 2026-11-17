export const MAX_VOTES = 20;
export const VOTE_DEADLINE_ISO = '2027-01-16T04:59:59Z';

export function remainingTime(nowMs: number) {
  const total = Math.max(
    0,
    Math.ceil((Date.parse(VOTE_DEADLINE_ISO) - nowMs) / 1000),
  );
  return {
    days: Math.floor(total / 86400),
    hours: Math.floor(total / 3600),
    minutes: Math.floor(total / 60) % 60,
    seconds: total % 60,
    expired: total === 0,
  };
}

export function formatCountdown(
  time: Pick<ReturnType<typeof remainingTime>, 'hours' | 'minutes' | 'seconds'>,
) {
  return [time.hours, time.minutes, time.seconds]
    .map((value) => String(value).padStart(2, '0'))
    .join(':');
}

export function formatDistance(meters: number) {
  const display = new Intl.NumberFormat('en-US', { maximumFractionDigits: 1 });
  return `${display.format(meters / 1000)} km · ${display.format(meters / 1609.344)} mi`;
}
