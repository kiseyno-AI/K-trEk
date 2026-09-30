const TICKETMASTER_ENDPOINT =
  'https://app.ticketmaster.com/discovery/v2/events.json';

const NYC_GEOHASH = 'dr5regw3';
const SEARCH_TERMS = ['K-pop', 'Korean', 'Korea', 'Korean music'];

const koreanMarkers = [
  'k-pop',
  'kpop',
  'korean',
  'korea',
  'seoul',
  'bts',
  'blackpink',
  'twice',
  'stray kids',
  'seventeen',
  'ateez',
  'enhypen',
  'nct',
  'aespa',
  'itzy',
  'le sserafim',
  'newjeans',
  'txt',
  'tomorrow x together',
  'iu',
  'day6',
  'the rose',
  'wave to earth',
];

type TicketmasterEvent = {
  id: string;
  name: string;
  url?: string;
  images?: Array<{
    url: string;
    width?: number;
    ratio?: string;
    fallback?: boolean;
  }>;
  dates?: { start?: { localDate?: string; localTime?: string } };
  classifications?: Array<{
    segment?: { name?: string };
    genre?: { name?: string };
  }>;
  _embedded?: {
    attractions?: Array<{ name?: string; aliases?: string[] }>;
    venues?: Array<{
      name?: string;
      city?: { name?: string };
      state?: { stateCode?: string };
    }>;
  };
};

function relevanceText(event: TicketmasterEvent) {
  const attractions = event._embedded?.attractions ?? [];
  return [
    event.name,
    ...attractions.flatMap((attraction) => [
      attraction.name ?? '',
      ...(attraction.aliases ?? []),
    ]),
  ]
    .join(' ')
    .toLocaleLowerCase('en');
}

function chooseImage(event: TicketmasterEvent) {
  return [...(event.images ?? [])].sort((a, b) => {
    const aScore =
      (a.fallback === false ? 10_000 : 0) +
      (a.ratio === '16_9' ? 5_000 : 0) +
      (a.width ?? 0);
    const bScore =
      (b.fallback === false ? 10_000 : 0) +
      (b.ratio === '16_9' ? 5_000 : 0) +
      (b.width ?? 0);
    return bScore - aScore;
  })[0]?.url;
}

function normalizeEvent(event: TicketmasterEvent) {
  const venue = event._embedded?.venues?.[0];
  const attractions = event._embedded?.attractions
    ?.map((attraction) => attraction.name)
    .filter(Boolean) as string[] | undefined;
  const classification = event.classifications?.[0];

  return {
    id: event.id,
    title: attractions?.length ? attractions.join(', ') : event.name,
    eventName: event.name,
    image: chooseImage(event) ?? '',
    venue: venue?.name ?? '장소 미정',
    city: venue?.city?.name ?? 'New York',
    state: venue?.state?.stateCode ?? 'NY',
    date: event.dates?.start?.localDate ?? '',
    time: event.dates?.start?.localTime,
    ticketUrl: event.url ?? 'https://www.ticketmaster.com/',
    category:
      classification?.genre?.name || classification?.segment?.name || 'Event',
  };
}

export async function GET() {
  const apiKey = process.env.TICKETMASTER_API_KEY;

  if (!apiKey) {
    return Response.json(
      {
        events: [],
        mode: 'preview',
        updatedAt: new Date().toISOString(),
        message: 'Ticketmaster API key is not configured.',
      },
      { headers: { 'Cache-Control': 'no-store' } },
    );
  }

  try {
    const startDateTime = new Date().toISOString().replace(/\.\d{3}Z$/, 'Z');
    const responses = await Promise.all(
      SEARCH_TERMS.map(async (keyword) => {
        const params = new URLSearchParams({
          apikey: apiKey,
          geoPoint: NYC_GEOHASH,
          radius: '75',
          unit: 'miles',
          countryCode: 'US',
          startDateTime,
          sort: 'date,asc',
          size: '50',
          includeTBA: 'no',
          includeTBD: 'no',
          locale: '*',
          keyword,
        });
        const response = await fetch(`${TICKETMASTER_ENDPOINT}?${params}`, {
          headers: { Accept: 'application/json' },
        });
        if (!response.ok)
          throw new Error(`Ticketmaster returned ${response.status}`);
        return (await response.json()) as {
          _embedded?: { events?: TicketmasterEvent[] };
        };
      }),
    );

    const uniqueEvents = new Map<string, TicketmasterEvent>();
    responses.forEach((response) => {
      response._embedded?.events?.forEach((event) =>
        uniqueEvents.set(event.id, event),
      );
    });

    const events = Array.from(uniqueEvents.values())
      .filter(
        (event) =>
          event.dates?.start?.localDate && event.url && chooseImage(event),
      )
      .sort((a, b) =>
        (a.dates?.start?.localDate ?? '').localeCompare(b.dates?.start?.localDate ?? '') ||
        Number(
          koreanMarkers.some((marker) => relevanceText(b).includes(marker)),
        ) -
          Number(
            koreanMarkers.some((marker) => relevanceText(a).includes(marker)),
          ),
      )
      .slice(0, 36)
      .map(normalizeEvent);

    return Response.json(
      { events, mode: 'live', updatedAt: new Date().toISOString() },
      {
        headers: {
          'Cache-Control':
            'public, max-age=300, s-maxage=900, stale-while-revalidate=3600',
        },
      },
    );
  } catch {
    return Response.json(
      {
        events: [],
        mode: 'preview',
        updatedAt: new Date().toISOString(),
        message: 'Ticketmaster data is temporarily unavailable.',
      },
      { status: 502, headers: { 'Cache-Control': 'no-store' } },
    );
  }
}
