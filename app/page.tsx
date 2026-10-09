'use client';

import {
  ArrowUpRight,
  CalendarDays,
  ExternalLink,
  LoaderCircle,
  MapPin,
  Search,
  Sparkles,
} from 'lucide-react';
import Image from 'next/image';
import { useEffect, useMemo, useState } from 'react';

import { Badge } from '@/components/ui/badge';

type EventItem = {
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

type EventsResponse = {
  events: EventItem[];
  sources?: string[];
  mode: 'live' | 'preview';
  updatedAt: string;
  message?: string;
};

const previewEvents: EventItem[] = [
  {
    id: 'preview-kpop',
    title: 'K‑Pop Live in New York',
    eventName: '한국 아티스트 콘서트',
    image:
      'https://images.unsplash.com/photo-1501386761578-eac5c94b800a?auto=format&fit=crop&w=1400&q=85',
    venue: 'Manhattan · 공연장 예시',
    city: 'New York',
    state: 'NY',
    date: '2026-10-18',
    time: '19:30:00',
    ticketUrl: 'https://www.ticketmaster.com/search?q=k-pop',
    category: 'K‑Pop',
    source: 'Ticketmaster',
    ctaLabel: 'Ticketmaster 검색',
  },
  {
    id: 'preview-culture',
    title: 'Korean Culture Showcase',
    eventName: '한국 문화 행사',
    image:
      'https://images.unsplash.com/photo-1531058020387-3be344556be6?auto=format&fit=crop&w=1400&q=85',
    venue: 'Queens · 행사장 예시',
    city: 'Queens',
    state: 'NY',
    date: '2026-11-07',
    time: '18:00:00',
    ticketUrl: 'https://www.ticketmaster.com/search?q=korean',
    category: 'Culture',
    source: '뉴욕한국문화원',
    ctaLabel: '행사 정보',
  },
  {
    id: 'preview-indie',
    title: 'K‑Indie Night',
    eventName: '한국 인디 음악 공연',
    image:
      'https://images.unsplash.com/photo-1524368535928-5b5e00ddc76b?auto=format&fit=crop&w=1400&q=85',
    venue: 'Brooklyn · 공연장 예시',
    city: 'Brooklyn',
    state: 'NY',
    date: '2026-11-21',
    time: '20:00:00',
    ticketUrl: 'https://www.ticketmaster.com/search?q=korean+music',
    category: 'K‑Indie',
    source: 'Ticketmaster',
    ctaLabel: 'Ticketmaster 검색',
  },
];

const dateFormatter = new Intl.DateTimeFormat('ko-KR', {
  month: 'long',
  day: 'numeric',
  weekday: 'short',
});

const timeFormatter = new Intl.DateTimeFormat('ko-KR', {
  hour: 'numeric',
  minute: '2-digit',
});

function formatEventDate(date: string, time?: string) {
  const value = new Date(`${date}T${time || '12:00:00'}`);
  if (Number.isNaN(value.getTime())) return date;
  const formattedDate = dateFormatter.format(value);
  return time
    ? `${formattedDate} · ${timeFormatter.format(value)}`
    : formattedDate;
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

export default function Home() {
  const [data, setData] = useState<EventsResponse>({
    events: previewEvents,
    mode: 'preview',
    updatedAt: new Date().toISOString(),
  });
  const [loading, setLoading] = useState(true);
  const [query, setQuery] = useState('');
  const [category, setCategory] = useState('전체');

  useEffect(() => {
    const controller = new AbortController();

    fetch('/api/events', { signal: controller.signal })
      .then((response) => {
        if (!response.ok) throw new Error('이벤트를 불러오지 못했습니다.');
        return response.json() as Promise<EventsResponse>;
      })
      .then((response) => {
        setData(
          response.events.length
            ? response
            : { ...response, events: previewEvents },
        );
      })
      .catch((error: unknown) => {
        if (error instanceof DOMException && error.name === 'AbortError')
          return;
        setData((current) => ({
          ...current,
          message: '잠시 후 다시 확인해 주세요.',
        }));
      })
      .finally(() => setLoading(false));

    return () => controller.abort();
  }, []);

  const upcomingEvents = useMemo(() => {
    const today = todayInNewYork();
    return data.events.filter((event) => event.date >= today);
  }, [data.events]);

  const categories = useMemo(() => {
    const available = new Set(upcomingEvents.map((event) => event.category));
    const preferred = [
      '콘서트',
      '공연',
      '영화',
      '전시',
      '음식',
      '강연',
      '문화',
    ];
    return [
      '전체',
      ...preferred.filter((item) => available.has(item)),
      ...Array.from(available).filter((item) => !preferred.includes(item)),
    ];
  }, [upcomingEvents]);

  const filteredEvents = useMemo(() => {
    const needle = query.trim().toLocaleLowerCase('ko');
    return upcomingEvents.filter((event) => {
      const matchesCategory =
        category === '전체' || event.category === category;
      const haystack =
        `${event.title} ${event.eventName} ${event.venue} ${event.city}`.toLocaleLowerCase(
          'ko',
        );
      return matchesCategory && (!needle || haystack.includes(needle));
    });
  }, [category, query, upcomingEvents]);

  return (
    <main className="min-h-screen overflow-hidden bg-background text-foreground">
      <div className="ambient ambient-one" aria-hidden="true" />
      <div className="ambient ambient-two" aria-hidden="true" />

      <header className="relative z-10 border-b border-white/10">
        <div className="mx-auto flex w-full max-w-[1280px] items-center justify-between px-5 py-5 sm:px-8 lg:px-10">
          <a
            href="#top"
            className="flex items-center gap-3"
            aria-label="K-Scene NYC 홈"
          >
            <span className="relative size-11 overflow-hidden rounded-xl bg-white shadow-[0_12px_30px_rgb(38_132_178/24%)] ring-1 ring-white/20">
              <Image
                src="/k-scene-logo.jpg"
                alt=""
                fill
                priority
                sizes="44px"
                className="object-cover"
              />
            </span>
            <span>
              <strong className="block text-[15px] font-bold tracking-[-0.02em]">
                K-SCENE NYC
              </strong>
              <span className="block text-[10px] font-semibold uppercase tracking-[0.19em] text-muted-foreground">
                Korean events nearby
              </span>
            </span>
          </a>
          <Badge
            className="h-7 border border-white/10 bg-white/[0.06] px-3 text-[11px] text-white"
            variant="outline"
          >
            <span className="mr-1.5 size-1.5 animate-pulse rounded-full bg-emerald-400" />
            NYC + 근교
          </Badge>
        </div>
      </header>

      <section
        id="top"
        className="relative z-10 mx-auto w-full max-w-[1280px] px-5 pb-10 pt-14 sm:px-8 sm:pt-20 lg:px-10"
      >
        <div className="max-w-3xl">
          <p className="mb-5 flex items-center gap-2 text-xs font-bold uppercase tracking-[0.22em] text-primary">
            <Sparkles className="size-4" /> 이번 주, 뉴욕에서 만나는 한국
          </p>
          <h1 className="text-balance text-[clamp(2.7rem,7vw,5.9rem)] font-black leading-[0.92] tracking-[-0.065em]">
            놓치면 아쉬운
            <br />
            <span className="headline-accent">K-이벤트만.</span>
          </h1>
          <p className="mt-7 max-w-xl text-pretty text-base leading-7 text-muted-foreground sm:text-lg">
            뉴욕과 근교의 콘서트, 공연, 영화, 전시, 음식과 강연을 공식 출처에서
            한데 모아 확인하세요.
          </p>
        </div>

        {!loading && data.sources?.length ? (
          <p className="mt-4 text-xs font-medium text-muted-foreground">
            출처 · {data.sources.join(' · ')}
          </p>
        ) : null}

        <div className="mt-10 grid gap-3 rounded-[26px] border border-white/10 bg-white/[0.055] p-3 shadow-[0_24px_80px_rgb(0_0_0/26%)] backdrop-blur-xl sm:grid-cols-[minmax(0,1fr)_auto]">
          <label className="flex min-h-12 items-center gap-3 rounded-2xl bg-black/20 px-4 focus-within:ring-2 focus-within:ring-primary/60">
            <Search className="size-4 text-muted-foreground" />
            <span className="sr-only">이벤트 검색</span>
            <input
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              placeholder="가수, 행사, 장소 검색"
              className="h-12 w-full bg-transparent text-sm outline-none placeholder:text-muted-foreground/70"
            />
          </label>
          <div
            className="flex gap-2 overflow-x-auto pb-1 sm:pb-0"
            aria-label="이벤트 종류"
          >
            {categories.map((item) => (
              <button
                type="button"
                key={item}
                onClick={() => setCategory(item)}
                aria-pressed={category === item}
                className="min-h-12 shrink-0 rounded-2xl px-4 text-sm font-semibold transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary aria-pressed:bg-primary aria-pressed:text-primary-foreground not-aria-pressed:bg-white/[0.06] not-aria-pressed:text-muted-foreground hover:not-aria-pressed:bg-white/10"
              >
                {item}
              </button>
            ))}
          </div>
        </div>

        {data.mode === 'preview' && !loading ? (
          <div className="mt-4 flex items-start gap-3 rounded-2xl border border-amber-300/15 bg-amber-200/[0.06] px-4 py-3 text-sm leading-6 text-amber-100/80">
            <Sparkles className="mt-1 size-4 shrink-0 text-amber-300" />
            지금은 일부 화면 예시입니다. 공식 행사 출처를 다시 확인하고
            있습니다.
          </div>
        ) : null}
      </section>

      <section className="relative z-10 mx-auto w-full max-w-[1280px] px-5 pb-24 sm:px-8 lg:px-10">
        <div className="mb-6 flex items-end justify-between gap-4">
          <div>
            <p className="text-xs font-bold uppercase tracking-[0.18em] text-muted-foreground">
              Upcoming
            </p>
            <h2 className="mt-2 text-2xl font-bold tracking-[-0.035em] sm:text-3xl">
              다가오는 이벤트
            </h2>
          </div>
          <p className="text-sm text-muted-foreground" aria-live="polite">
            {loading ? (
              <span className="flex items-center gap-2">
                <LoaderCircle className="size-4 animate-spin" /> 불러오는 중
              </span>
            ) : (
              `${filteredEvents.length}개`
            )}
          </p>
        </div>

        {filteredEvents.length ? (
          <div className="grid gap-5 md:grid-cols-2 xl:grid-cols-3">
            {filteredEvents.map((event) => (
              <article
                key={event.id}
                className="event-card group overflow-hidden rounded-[26px] border border-white/10 bg-card shadow-[0_18px_50px_rgb(0_0_0/22%)]"
              >
                <div className="relative aspect-[16/9] overflow-hidden bg-muted">
                  <Image
                    src={event.image}
                    alt=""
                    fill
                    unoptimized
                    sizes="(min-width: 1280px) 400px, (min-width: 768px) 50vw, 100vw"
                    className="h-full w-full object-cover transition duration-500 group-hover:scale-[1.035]"
                  />
                  <div className="absolute inset-0 bg-gradient-to-t from-black/70 via-transparent to-black/10" />
                  <Badge className="absolute left-4 top-4 border-0 bg-black/55 px-2.5 text-white backdrop-blur-md">
                    {event.category}
                  </Badge>
                  <span className="absolute right-4 top-4 rounded-full bg-black/55 px-2.5 py-1 text-[10px] font-bold tracking-wide text-white/85 backdrop-blur-md">
                    {event.source}
                  </span>
                  <p className="absolute bottom-4 left-4 right-4 text-xs font-semibold text-white/80">
                    {formatEventDate(event.date, event.time)}
                  </p>
                </div>

                <div className="flex min-h-[250px] flex-col p-5">
                  <p className="mb-2 text-xs font-semibold uppercase tracking-[0.14em] text-primary">
                    {event.eventName}
                  </p>
                  <h3 className="text-balance text-[1.4rem] font-bold leading-tight tracking-[-0.035em]">
                    {event.title}
                  </h3>

                  <div className="mt-5 space-y-3 text-sm text-muted-foreground">
                    <p className="flex items-start gap-2.5">
                      <CalendarDays className="mt-0.5 size-4 shrink-0 text-primary" />
                      {formatEventDate(event.date, event.time)}
                    </p>
                    <p className="flex items-start gap-2.5">
                      <MapPin className="mt-0.5 size-4 shrink-0 text-primary" />
                      <span>
                        {event.venue}
                        <span className="block text-xs text-muted-foreground/70">
                          {event.city}, {event.state}
                        </span>
                      </span>
                    </p>
                  </div>

                  <a
                    href={event.ticketUrl}
                    target="_blank"
                    rel="noreferrer"
                    className="mt-auto flex min-h-12 items-center justify-between rounded-2xl bg-foreground px-4 text-sm font-bold text-background transition hover:bg-primary hover:text-primary-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2 focus-visible:ring-offset-card"
                    aria-label={`${event.title} ${event.ctaLabel}`}
                  >
                    <span className="flex items-center gap-2">
                      <ExternalLink className="size-4" /> {event.ctaLabel}
                    </span>
                    <ArrowUpRight className="size-4" />
                  </a>
                </div>
              </article>
            ))}
          </div>
        ) : (
          <div className="grid min-h-64 place-items-center rounded-[26px] border border-dashed border-white/15 bg-white/[0.035] px-6 text-center">
            <div>
              <Search className="mx-auto mb-4 size-8 text-muted-foreground" />
              <h3 className="font-bold">조건에 맞는 이벤트가 없어요.</h3>
              <p className="mt-2 text-sm text-muted-foreground">
                검색어를 지우거나 다른 종류를 선택해 보세요.
              </p>
            </div>
          </div>
        )}
      </section>

      <footer className="relative z-10 border-t border-white/10 px-5 py-8 text-center text-xs leading-6 text-muted-foreground">
        Ticketmaster, 뉴욕한국문화원, The Korea Society의 공식 정보를 모아
        보여드립니다. 최종 일정과 예약 조건은 각 행사 페이지에서 확인해 주세요.
      </footer>
    </main>
  );
}
