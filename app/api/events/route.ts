const TICKETMASTER_ENDPOINT =
  'https://app.ticketmaster.com/discovery/v2/events.json';
const KCCNY_ORIGIN = 'https://www.koreanculture.org';
const KOREA_SOCIETY_EVENTS_URL =
  'https://www.koreasociety.org/wp-json/wp/v2/pages?slug=programs-events&_fields=id,slug,modified,link,title,content';

const NYC_GEOHASH = 'dr5regw3';
const SEARCH_TERMS = ['K-pop', 'Korean', 'Korea', 'Korean music'];
const KOREA_SOCIETY_IMAGE_ROOT =
  'https://www.koreasociety.org/images/billboard/2026/';

const kccnyFeeds = [
  { path: 'performing-arts', category: '공연' },
  { path: 'films', category: '영화' },
  { path: 'gallery-korea', category: '전시' },
  { path: 'cuisine-tourism', category: '음식' },
  { path: 'education-literature', category: '강연' },
  { path: 'special-events', category: '문화' },
] as const;

const monthNumbers: Record<string, number> = {
  january: 1,
  february: 2,
  march: 3,
  april: 4,
  may: 5,
  june: 6,
  july: 7,
  august: 8,
  september: 9,
  october: 10,
  november: 11,
  december: 12,
};

type EventCard = {
  id: string;
  title: string;
  eventName: string;
  image: string;
  venue: string;
  city: string;
  state: string;
  date: string;
  time?: string;
  ticketUrl: string;
  category: string;
  source: string;
  ctaLabel: string;
};

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
    attractions?: Array<{ name?: string }>;
    venues?: Array<{
      name?: string;
      city?: { name?: string };
      state?: { stateCode?: string };
    }>;
  };
};

type KccnyFeedItem = {
  id: string;
  title: string;
  link: string;
  image: string;
  description: string;
  body: string;
  publishedAt?: number;
};

function decodeEntities(value: string) {
  return value
    .replace(/&amp;/gi, '&')
    .replace(/&quot;/gi, '"')
    .replace(/&#39;|&apos;/gi, "'")
    .replace(/&nbsp;|&#160;/gi, ' ')
    .replace(/&#(\d+);/g, (_, code: string) =>
      String.fromCodePoint(Number(code)),
    );
}

function plainText(value?: string) {
  return decodeEntities(
    String(value ?? '')
      .replace(/<style[\s\S]*?<\/style>/gi, ' ')
      .replace(/<script[\s\S]*?<\/script>/gi, ' ')
      .replace(/<[^>]+>/g, ' ')
      .replace(/\s+/g, ' '),
  ).trim();
}

function unwrapCdata(value: string) {
  return value
    .replace(/^\s*<!\[CDATA\[/, '')
    .replace(/\]\]>\s*$/, '')
    .trim();
}

function xmlField(item: string, field: string) {
  const escaped = field.replace(':', '\\:');
  return unwrapCdata(
    item.match(
      new RegExp(`<${escaped}[^>]*>([\\s\\S]*?)<\\/${escaped}>`, 'i'),
    )?.[1] ?? '',
  );
}

function parseKccnyRss(xml: string): KccnyFeedItem[] {
  const normalized = xml.replace(/&nbsp;/gi, '&amp;nbsp;');
  return Array.from(normalized.matchAll(/<item>([\s\S]*?)<\/item>/gi)).map(
    (match) => {
      const item = match[1];
      const published = xmlField(item, 'pubDate');
      const body = xmlField(item, 'content:encoded');
      return {
        id:
          plainText(xmlField(item, 'guid')) ||
          plainText(xmlField(item, 'link')),
        title: plainText(xmlField(item, 'title')),
        link: plainText(xmlField(item, 'link')),
        image:
          decodeEntities(
            item.match(/<media:content[^>]+url=["']([^"']+)["']/i)?.[1] ?? '',
          ) ||
          decodeEntities(
            item.match(/<enclosure[^>]+url=["']([^"']+)["']/i)?.[1] ?? '',
          ) ||
          decodeEntities(
            body.match(/<img[^>]+data-image=["']([^"']+)["']/i)?.[1] ??
              body.match(/<img[^>]+src=["']([^"']+)["']/i)?.[1] ??
              '',
          ),
        description: xmlField(item, 'description'),
        body,
        publishedAt: published ? Date.parse(published) : undefined,
      };
    },
  );
}

function extractRegistrationUrl(html: string, fallback: string) {
  for (const match of html.matchAll(
    /<a\b[^>]*href=["']([^"']+)["'][^>]*>([\s\S]*?)<\/a>/gi,
  )) {
    const label = plainText(match[2]);
    if (/tickets?|register|registration|rsvp|reserve/i.test(label)) {
      try {
        return new URL(decodeEntities(match[1]), KCCNY_ORIGIN).toString();
      } catch {
        continue;
      }
    }
  }
  return fallback;
}

function toIsoDate(year: number, month: number, day: number) {
  return `${year.toString().padStart(4, '0')}-${month
    .toString()
    .padStart(2, '0')}-${day.toString().padStart(2, '0')}`;
}

function todayInNewYork() {
  const parts = new Intl.DateTimeFormat('en-CA', {
    timeZone: 'America/New_York',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).formatToParts(new Date());
  const value = Object.fromEntries(
    parts.map((part) => [part.type, part.value]),
  );
  return `${value.year}-${value.month}-${value.day}`;
}

function dateFromKccnyPath(fullUrl?: string, publishOn?: number) {
  const match = fullUrl?.match(/\/(20\d{2})\/(\d{1,2})\/(\d{1,2})\//);
  if (match)
    return toIsoDate(Number(match[1]), Number(match[2]), Number(match[3]));
  if (!publishOn) return '';
  const date = new Date(publishOn);
  return toIsoDate(
    date.getUTCFullYear(),
    date.getUTCMonth() + 1,
    date.getUTCDate(),
  );
}

function mentionedDates(text: string, fallbackDate: string) {
  const fallbackYear = Number(fallbackDate.slice(0, 4));
  return Array.from(
    text.matchAll(
      /\b(January|February|March|April|May|June|July|August|September|October|November|December)\s+(\d{1,2})(?:st|nd|rd|th)?(?:,?\s+(20\d{2}))?/gi,
    ),
  )
    .map((match) =>
      toIsoDate(
        Number(match[3] ?? fallbackYear),
        monthNumbers[match[1].toLocaleLowerCase('en')],
        Number(match[2]),
      ),
    )
    .sort();
}

function extractTime(text: string) {
  const match = text.match(/\b(\d{1,2})(?::(\d{2}))?\s*(AM|PM)\b/i);
  if (!match) return undefined;
  let hour = Number(match[1]) % 12;
  if (match[3].toUpperCase() === 'PM') hour += 12;
  return `${hour.toString().padStart(2, '0')}:${(match[2] ?? '00').padStart(2, '0')}:00`;
}

function extractVenue(text: string) {
  const labelled = text
    .match(/Venue\s*:\s*(.{3,120}?)(?=\s*\(|\s+\d{2,5}\s+[A-Z]|$)/i)?.[1]
    ?.trim();
  if (labelled) return labelled;

  const knownVenues = [
    'Jersey City Theater Center at White Eagle Hall',
    'The Downstairs Theatre at La MaMa',
    'Merkin Hall at Kaufman Music Center',
    'Zankel Hall at Carnegie Hall',
    'Korean Cultural Center New York',
    'Greenwich House Music School',
    'Wade Thompson Drill Hall',
    'Gallery & Atrium at the KCCNY',
    'Atrium & Gallery at the KCCNY',
    'Palace Theatre Stamford',
    'Pioneer Works',
    'Fridman Gallery',
    'Carnegie Hall',
  ];
  return (
    knownVenues.find((venue) => text.includes(venue)) ?? '공식 페이지에서 확인'
  );
}

function locationFromText(text: string) {
  if (/Stamford/i.test(text)) return { city: 'Stamford', state: 'CT' };
  if (/Newark|Jersey City/i.test(text))
    return { city: 'New Jersey', state: 'NJ' };
  if (/Brooklyn/i.test(text)) return { city: 'Brooklyn', state: 'NY' };
  if (/Queens|Flushing/i.test(text)) return { city: 'Queens', state: 'NY' };
  return { city: 'New York', state: 'NY' };
}

function chooseTicketmasterImage(event: TicketmasterEvent) {
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

function ticketmasterCategory(event: TicketmasterEvent) {
  const segment = event.classifications?.[0]?.segment?.name;
  if (segment === 'Music') return '콘서트';
  if (segment === 'Arts & Theatre') return '공연';
  return '문화';
}

function normalizeTicketmasterEvent(event: TicketmasterEvent): EventCard {
  const venue = event._embedded?.venues?.[0];
  const attractions = event._embedded?.attractions
    ?.map((attraction) => attraction.name)
    .filter(Boolean) as string[] | undefined;

  return {
    id: `ticketmaster-${event.id}`,
    title: attractions?.length ? attractions.join(', ') : event.name,
    eventName: event.name,
    image: chooseTicketmasterImage(event) ?? '',
    venue: venue?.name ?? '장소 미정',
    city: venue?.city?.name ?? 'New York',
    state: venue?.state?.stateCode ?? 'NY',
    date: event.dates?.start?.localDate ?? '',
    time: event.dates?.start?.localTime,
    ticketUrl: event.url ?? 'https://www.ticketmaster.com/',
    category: ticketmasterCategory(event),
    source: 'Ticketmaster',
    ctaLabel: '티켓 보기',
  };
}

async function fetchTicketmasterEvents(apiKey?: string) {
  if (!apiKey) return [];
  const startDateTime = new Date().toISOString().replace(/\.\d{3}Z$/, 'Z');
  const responses = await Promise.allSettled(
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
    if (response.status !== 'fulfilled') return;
    response.value._embedded?.events?.forEach((event) =>
      uniqueEvents.set(event.id, event),
    );
  });

  return Array.from(uniqueEvents.values())
    .filter(
      (event) =>
        event.dates?.start?.localDate &&
        event.url &&
        chooseTicketmasterImage(event),
    )
    .map(normalizeTicketmasterEvent);
}

function normalizeKccnyEvent(
  item: KccnyFeedItem,
  category: string,
  today: string,
): EventCard | null {
  const pathDate = dateFromKccnyPath(item.link, item.publishedAt);
  const text = plainText(item.description);
  const dates = mentionedDates(text, pathDate);
  const date = dates[0] ?? pathDate;
  const endDate = dates.at(-1) ?? date;
  const title = plainText(item.title);
  if (!date || !title || !item.link || !item.image || endDate < today)
    return null;

  const location = locationFromText(text);
  const free = /\bfree\b/i.test(text);
  const detailUrl = new URL(item.link, KCCNY_ORIGIN).toString();
  return {
    id: `kccny-${item.id.replace(/[^a-z0-9]+/gi, '-').slice(-80)}`,
    title,
    eventName:
      category === '영화' ? '한국 영화 프로그램' : '한국문화원 공식 행사',
    image: item.image.startsWith('//') ? `https:${item.image}` : item.image,
    venue: extractVenue(text),
    city: location.city,
    state: location.state,
    date,
    time: extractTime(text),
    ticketUrl: extractRegistrationUrl(item.body, detailUrl),
    category,
    source: '뉴욕한국문화원',
    ctaLabel: free ? '무료 예약·정보' : '행사 정보',
  };
}

async function fetchKccnyEvents(today: string) {
  const responses = await Promise.allSettled(
    kccnyFeeds.map(async (feed) => {
      const response = await fetch(`${KCCNY_ORIGIN}/${feed.path}?format=rss`, {
        headers: {
          Accept: 'application/rss+xml, application/xml;q=0.9, text/xml;q=0.8',
          'User-Agent':
            'K-Scene NYC event aggregator (+https://k-scene-nyc.shawn-kang.chatgpt.site)',
        },
      });
      if (!response.ok) throw new Error(`KCCNY returned ${response.status}`);
      return parseKccnyRss(await response.text())
        .map((item) => normalizeKccnyEvent(item, feed.category, today))
        .filter((event): event is EventCard => Boolean(event));
    }),
  );

  return responses.flatMap((response) =>
    response.status === 'fulfilled' ? response.value : [],
  );
}

function splitEventObjects(source: string) {
  const start = source.indexOf('const EVENTS = [');
  if (start < 0) return [];
  const end = source.indexOf('];', start);
  const input = source.slice(start, end < 0 ? undefined : end);
  const objects: string[] = [];
  let depth = 0;
  let objectStart = -1;
  let inString = false;
  let escaped = false;

  for (let index = 0; index < input.length; index += 1) {
    const character = input[index];
    if (inString) {
      if (escaped) escaped = false;
      else if (character === '\\') escaped = true;
      else if (character === '"') inString = false;
      continue;
    }
    if (character === '"') {
      inString = true;
      continue;
    }
    if (character === '{') {
      if (depth === 0) objectStart = index;
      depth += 1;
    } else if (character === '}') {
      depth -= 1;
      if (depth === 0 && objectStart >= 0) {
        objects.push(input.slice(objectStart, index + 1));
        objectStart = -1;
      }
    }
  }
  return objects;
}

function readJsStringField(source: string, field: string) {
  const match = source.match(new RegExp(`\\b${field}:"((?:\\\\.|[^"\\\\])*)"`));
  if (!match) return '';
  try {
    return decodeEntities(JSON.parse(`"${match[1]}"`) as string);
  } catch {
    return decodeEntities(match[1]);
  }
}

function koreaSocietyCategory(block: string) {
  if (/Cuisine/i.test(block)) return '음식';
  if (/Literature|Author Talk/i.test(block)) return '강연';
  if (/Arts & Culture/i.test(block)) return '문화';
  return '강연';
}

function normalizeKoreaSocietyEvent(
  block: string,
  today: string,
): EventCard | null {
  const title = readJsStringField(block, 'title');
  const date = readJsStringField(block, 'start');
  const endDate = readJsStringField(block, 'end') || date;
  const url = readJsStringField(block, 'url');
  const location = readJsStringField(block, 'loc');
  const timeText = readJsStringField(block, 'time');
  const categoryLabel = readJsStringField(block, 'cat');
  const absoluteImage = readJsStringField(block, 'img');
  const relativeImage = block.match(/\bimg:IMG\+"((?:\\.|[^"])*)"/)?.[1];
  const image =
    absoluteImage ||
    (relativeImage ? `${KOREA_SOCIETY_IMAGE_ROOT}${relativeImage}` : '');

  if (
    !title ||
    !date ||
    !url ||
    !image ||
    endDate < today ||
    /\bOnline\b/i.test(location)
  ) {
    return null;
  }

  return {
    id: `korea-society-${date}-${title.toLocaleLowerCase('en').replace(/[^a-z0-9]+/g, '-')}`,
    title,
    eventName: categoryLabel || 'Korea Society 프로그램',
    image,
    venue: location || 'The Korea Society',
    city: 'New York',
    state: 'NY',
    date,
    time: extractTime(timeText),
    ticketUrl: url,
    category: koreaSocietyCategory(block),
    source: 'The Korea Society',
    ctaLabel: '행사 정보',
  };
}

async function fetchKoreaSocietyEvents(today: string) {
  const response = await fetch(KOREA_SOCIETY_EVENTS_URL, {
    headers: {
      Accept: 'application/json',
      'User-Agent':
        'K-Scene NYC event aggregator (+https://k-scene-nyc.shawn-kang.chatgpt.site)',
    },
  });
  if (!response.ok)
    throw new Error(`Korea Society returned ${response.status}`);
  const pages = (await response.json()) as Array<{
    content?: { rendered?: string };
  }>;
  const html = pages[0]?.content?.rendered ?? '';
  return splitEventObjects(html)
    .map((block) => normalizeKoreaSocietyEvent(block, today))
    .filter((event): event is EventCard => Boolean(event));
}

function dedupeEvents(events: EventCard[], today: string) {
  const unique = new Map<string, EventCard>();
  events.forEach((event) => {
    if (event.date < today) return;
    const key = `${event.date}-${event.title
      .toLocaleLowerCase('en')
      .replace(/[^a-z0-9가-힣]+/g, '')}`;
    if (!unique.has(key)) unique.set(key, event);
  });
  return Array.from(unique.values()).sort(
    (a, b) =>
      a.date.localeCompare(b.date) ||
      (a.time ?? '').localeCompare(b.time ?? ''),
  );
}

export async function GET() {
  const today = todayInNewYork();
  const results = await Promise.allSettled([
    fetchTicketmasterEvents(process.env.TICKETMASTER_API_KEY),
    fetchKccnyEvents(today),
    fetchKoreaSocietyEvents(today),
  ]);
  const events = dedupeEvents(
    results.flatMap((result) =>
      result.status === 'fulfilled' ? result.value : [],
    ),
    today,
  ).slice(0, 72);
  const sources = [
    results[0].status === 'fulfilled' && results[0].value.length
      ? 'Ticketmaster'
      : null,
    results[1].status === 'fulfilled' && results[1].value.length
      ? '뉴욕한국문화원'
      : null,
    results[2].status === 'fulfilled' && results[2].value.length
      ? 'The Korea Society'
      : null,
  ].filter((source): source is string => Boolean(source));

  return Response.json(
    {
      events,
      sources,
      mode: events.length ? 'live' : 'preview',
      updatedAt: new Date().toISOString(),
      message:
        results.some((result) => result.status === 'rejected') && events.length
          ? '일부 출처를 일시적으로 불러오지 못했습니다.'
          : undefined,
    },
    {
      status: events.length ? 200 : 502,
      headers: {
        'Cache-Control': events.length
          ? 'public, max-age=300, s-maxage=900, stale-while-revalidate=3600'
          : 'no-store',
      },
    },
  );
}
