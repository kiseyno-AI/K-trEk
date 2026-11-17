'use client';
/* oxlint-disable jsx-a11y/prefer-tag-over-role, jsx-a11y/no-noninteractive-element-interactions, jsx-a11y/no-noninteractive-element-to-interactive-role, jsx-a11y/no-static-element-interactions, jsx-a11y/no-noninteractive-tabindex */

import {
  ArrowLeft,
  ArrowRight,
  Check,
  CarFront,
  BusFront,
  TramFront,
  Clock3,
  Heart,
  MapPin,
  CalendarCheck,
  Globe2,
  Users,
  UserRound,
  Settings2,
  LogOut,
  LayoutGrid,
  List,
  X,
} from 'lucide-react';
import {
  Fragment,
  useCallback,
  useEffect,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
} from 'react';
import { PlanetCanvas } from './planet-canvas';
import Image from 'next/image';
import { TripLogin } from './trip-login';
import { HostReviews } from './host-reviews';
import {
  CommunityControls,
  ReportComposer,
  useMemberPreferences,
} from './trip-community';
import { TripVoiceHost, type TripVoiceActions } from './trip-voice';
import type { TripUser } from '../lib/trip-auth';
import {
  TRIP_ORIGIN_PRESETS,
  resolveTripOrigin,
  type TripOrigin,
} from '../lib/trip-origin';
import { AnimatedCountdown } from './animated-countdown';
import { morphCard, flyCards, type CardMorphSource } from '../lib/card-morph';
import {
  bindCarouselScrollLock,
  carouselWheelGesture,
} from '../lib/carousel-wheel';
import { readTripSession } from '../lib/trip-session';
import { version as appVersion } from '../package.json';
import { activityPage, observeGridPageSize } from '../lib/activity-pagination';
import {
  mapRouteFor,
  ROUTE_COLORS,
  type MapRoute,
  type RouteMode,
} from '../lib/route-ribbon';
import { sitePath } from '../lib/site-path';
import { activityFacts } from '../lib/activity-presentation';
import {
  MAX_VOTES,
  VOTE_DEADLINE_ISO,
  remainingTime,
  formatDistance,
  formatCountdown,
} from '../lib/vote-planning';

import { CATEGORIES, toActivity, type Activity } from '../lib/activities';
import type { DrivingRouteResponse } from '../lib/driving-route';

function ActivityInformation({ activity }: { activity: Activity }) {
  const d = activity.details;
  const facts = activityFacts(activity);
  const links = [
    ['Booking page', d.booking_url],
    ['Google Maps', d.google_maps_url],
    ['English website', d.english_website_url],
    ...d.youtube_video_urls.map((url, i) => [`Related video ${i + 1}`, url]),
    ['YouTube search', d.youtube_search_url],
    ['Official video channel', d.youtube_channel_url],
  ].filter(([, url]) => url);
  return (
    <div className="activity-information">
      {facts.length > 0 && (
        <dl>
          {facts.map(([label, value]) => (
            <div key={label}>
              <dt>{label}</dt>
              <dd>{value}</dd>
            </div>
          ))}
        </dl>
      )}
      {links.length > 0 && (
        <div className="activity-links">
          {links.map(([label, url]) => (
            <a key={label} href={url!} target="_blank" rel="noreferrer">
              {label === 'Booking page' ? (
                url!.includes('naver.com') ? (
                  <Image
                    width={20}
                    height={20}
                    unoptimized
                    className="activity-link-icon"
                    src={sitePath('/trip/icons/naver.png')}
                    alt=""
                  />
                ) : url!.includes('catchtable') ? (
                  <Image
                    width={20}
                    height={20}
                    unoptimized
                    className="activity-link-icon"
                    src={sitePath('/trip/icons/catchtable.png')}
                    alt=""
                  />
                ) : (
                  <CalendarCheck className="activity-link-icon" />
                )
              ) : label === 'Google Maps' ? (
                <Image
                  width={20}
                  height={20}
                  unoptimized
                  className="activity-link-icon"
                  src={sitePath('/trip/icons/google-maps.png')}
                  alt=""
                />
              ) : label?.includes('video') || label?.startsWith('YouTube') ? (
                <Image
                  width={20}
                  height={20}
                  unoptimized
                  className="activity-link-icon"
                  src={sitePath('/trip/icons/youtube.png')}
                  alt=""
                />
              ) : (
                <Globe2 className="activity-link-icon" />
              )}
              {label}
              <ArrowRight size={14} />
            </a>
          ))}
        </div>
      )}
      <details className="activity-sources">
        <summary>Sources &amp; verification</summary>
        {d.source_urls.map((url) => (
          <a key={url} href={url} target="_blank" rel="noreferrer">
            {new URL(url).hostname}
            <ArrowRight size={12} />
          </a>
        ))}
        {d.image_reference_urls.map((url, index) => (
          <a key={url} href={url} target="_blank" rel="noreferrer">
            {index === 0 && d.image_rights === 'licensed' && d.image_attribution
              ? d.image_attribution
              : 'Photo reference'}
            <ArrowRight size={12} />
          </a>
        ))}
      </details>
    </div>
  );
}
function BackgroundStage({
  intro,
  activity,
  detailZoom,
  mapRoute,
  origin,
  onBrowseReady,
}: {
  intro: boolean;
  activity: Activity | undefined;
  detailZoom: boolean;
  mapRoute: MapRoute | null;
  origin: TripOrigin;
  onBrowseReady: () => void;
}) {
  const focus = activity?.mapFocus;
  return (
    <>
      <div className="map-stage" aria-hidden="true">
        <PlanetCanvas
          activityId={activity?.id ?? ''}
          locationName={activity?.title ?? ''}
          longitude={focus?.[0] ?? null}
          latitude={focus?.[1] ?? null}
          intro={intro}
          detailZoom={detailZoom}
          mapRoute={mapRoute}
          origin={origin}
          onBrowseReady={onBrowseReady}
        />
        <div className="background-shade" />
      </div>
      {detailZoom && (
        <p className="map-attribution">
          <a
            href="https://github.com/vuski/admdongkor"
            target="_blank"
            rel="noreferrer"
          >
            SGIS · vuski
          </a>
          <span> · </span>
          <a
            href="https://www.openstreetmap.org/copyright"
            target="_blank"
            rel="noreferrer"
          >
            © OpenStreetMap
          </a>
          {mapRoute && (
            <>
              <span> · </span>
              <a
                href="https://developers.kakaomobility.com/guide/navi-api/directions.html"
                target="_blank"
                rel="noreferrer"
              >
                Route data
              </a>
            </>
          )}
        </p>
      )}
    </>
  );
}

export default function ActivityExplorer({
  activities: initialActivities,
  origin: initialOrigin,
  voiceEnabled = false,
}: {
  activities: Activity[];
  origin: TripOrigin;
  voiceEnabled?: boolean;
}) {
  const [activities, setActivities] = useState(initialActivities);
  const availableActivityIds = useMemo(
    () => new Set(initialActivities.map((activity) => activity.id)),
    [initialActivities],
  );
  useEffect(() => {
    let active = true;
    queueMicrotask(() => {
      if (active) setActivities(initialActivities);
    });
    return () => { active = false; };
  }, [initialActivities]);
  const [intro, setIntro] = useState(true);
  const [viewer, setViewer] = useState<TripUser | 'visitor' | null | undefined>(
    undefined,
  );
  const user = viewer && typeof viewer === 'object' ? viewer : null;
  const accessGranted = viewer !== undefined && viewer !== null;
  const [countryArrived, setCountryArrived] = useState(false);
  const [accountError, setAccountError] = useState('');
  const favoriteRequest = useRef<AbortController | null>(null);
  const [favoriteSaving, setFavoriteSaving] = useState(false);
  useEffect(() => {
    const controller = new AbortController();
    void readTripSession(controller.signal).then((session) => {
      if (!controller.signal.aborted) setViewer(session);
    });
    return () => controller.abort();
  }, []);
  const [headingArrived, setHeadingArrived] = useState(false);
  const [cardFlight, setCardFlight] = useState<
    (CardMorphSource & { backgroundImage: string }) | null
  >(null);
  const [focusedActivityId, setFocusedActivityId] = useState(
    activities[0]?.id ?? '',
  );
  const [detailActivityId, setDetailActivityId] = useState<string | null>(null);
  const [detailLeaving, setDetailLeaving] = useState(false);
  const closeAfterMorph = useRef(false);
  const [routeMode, setRouteMode] = useState<RouteMode>('drive');
  const [departureId, setDepartureId] = useState('default');
  const origin = resolveTripOrigin(departureId, initialOrigin);
  const [routeResult, setRouteResult] = useState<{
    activityId: string;
    origin: TripOrigin;
    result: DrivingRouteResponse;
  } | null>(null);
  const [routeAttempt, setRouteAttempt] = useState(0);

  const [favoriteIds, setFavoriteIds] = useState<string[]>([]);
  const [draftVoteIds, setDraftVoteIds] = useState<string[]>([]);
  const [submittedVoteIds, setSubmittedVoteIds] = useState<string[]>([]);
  const [votesHydratedFor, setVotesHydratedFor] = useState<string | null>(null);
  const [category, setCategory] = useState('all');
  const [displayCategory, setDisplayCategory] = useState('all');
  const [viewMode, setViewMode] = useState<'list' | 'grid'>('list');
  const [gridPaging, setGridPaging] = useState({ page: 1, size: 0 });
  const pendingCategory = useRef('all');
  const [picksOpen, setPicksOpen] = useState(false);
  const [picksMode, setPicksMode] = useState<'votes' | 'favorites'>('votes');
  const [browsePhase, setBrowsePhase] = useState<
    'ready' | 'returning' | 'entering' | 'exiting'
  >('returning');
  const onBrowseReady = useCallback(() => setCountryArrived(true), []);
  useLayoutEffect(() => {
    let active = true;
    if (
      !intro &&
      accessGranted &&
      countryArrived &&
      browsePhase === 'returning'
    ) {
      queueMicrotask(() => {
        if (active)
          setBrowsePhase(
            matchMedia('(prefers-reduced-motion: reduce)').matches
              ? 'ready'
              : 'entering',
          );
      });
    }
    return () => {
      active = false;
    };
  }, [intro, accessGranted, countryArrived, browsePhase]);
  const returnFocus = useRef<HTMLElement | null>(null);
  const dragStart = useRef<number | null>(null);
  const dragged = useRef(false);
  const wheelGesture = useRef<ReturnType<typeof carouselWheelGesture> | null>(
    null,
  );
  const panelRef = useRef<HTMLElement | null>(null);
  const cardRef = useRef<HTMLElement | null>(null);
  const focusAfterMove = useRef(false);
  const flightSurfaceRef = useRef<HTMLDivElement>(null);
  const flightPhotoRef = useRef<HTMLDivElement>(null);
  const flightCopyRef = useRef<HTMLDivElement>(null);
  const cardAnimations = useRef<Animation[]>([]);
  const cardsRef = useRef<HTMLDivElement>(null);
  const bindCards = useCallback((node: HTMLDivElement | null) => {
    cardsRef.current = node;
    if (!node) return;
    const release = viewMode === 'list'
      ? bindCarouselScrollLock(node)
      : observeGridPageSize(node, (size) => {
          setGridPaging((previous) => {
            if (previous.size === size) return previous;
            const start = (previous.page - 1) * Math.max(1, previous.size);
            return { size, page: Math.floor(start / Math.max(1, size)) + 1 };
          });
        });
    return () => {
      release();
      if (cardsRef.current === node) cardsRef.current = null;
    };
  }, [viewMode]);
  const expireSession = useCallback(() => {
    setViewer(null);
    setPicksOpen(false);
    if (panelRef.current) setCountryArrived(false);
    setDetailActivityId(null);
    setCardFlight(null);
    setBrowsePhase('returning');
  }, []);
  const [documentActive, setDocumentActive] = useState(true);
  const [voteNow, setVoteNow] = useState(Date.now);
  const countdown = remainingTime(voteNow);
  useEffect(() => {
    if (!detailActivityId || !user) return;
    const controller = new AbortController();
    let active = true;
    const timeout = setTimeout(() => controller.abort(), 15000);
    void (async () => {
      try {
        const response = await fetch(
          sitePath(
            `/directions/${encodeURIComponent(detailActivityId)}?origin=${encodeURIComponent(departureId)}`,
          ),
          { signal: controller.signal, cache: 'no-store' },
        );
        if (response.status === 401) {
          if (active) {
            expireSession();
          }
          return;
        }
        const result = (await response.json()) as DrivingRouteResponse;
        if (
          !result.status ||
          (result.status === 'ok' &&
            (result.activityId !== detailActivityId ||
              result.origin.longitude !== origin.longitude ||
              result.origin.latitude !== origin.latitude ||
              result.origin.name !== origin.name))
        )
          throw new Error('Invalid driving response');
        if (active) setRouteResult({ activityId: detailActivityId, origin, result });
      } catch {
        if (active)
          setRouteResult({
            activityId: detailActivityId,
            origin,
            result: {
              status: 'upstream_error',
              message: 'Driving directions are unavailable. Please try again.',
            },
          });
      } finally {
        clearTimeout(timeout);
      }
    })();
    return () => {
      active = false;
      clearTimeout(timeout);
      controller.abort();
    };
  }, [detailActivityId, routeAttempt, user, origin, departureId, expireSession]);
  useEffect(() => {
    if (!accessGranted || intro || !documentActive || countdown.expired) return;
    let active = true;
    queueMicrotask(() => {
      if (active) setVoteNow(Date.now());
    });
    const interval = setInterval(() => setVoteNow(Date.now()), 1000);
    return () => {
      active = false;
      clearInterval(interval);
    };
  }, [accessGranted, intro, documentActive, countdown.expired]);
  useEffect(() => {
    const timer = setTimeout(
      () => {
        setIntro(false);
      },
      matchMedia('(prefers-reduced-motion: reduce)').matches ? 0 : 8500,
    );
    return () => clearTimeout(timer);
  }, []);
  useEffect(() => {
    const controller = new AbortController();
    queueMicrotask(() => {
      if (controller.signal.aborted) return;
      setFavoriteIds([]);
      setDraftVoteIds([]);
      setSubmittedVoteIds([]);
      setVotesHydratedFor(null);
      setAccountError('');
      if (user) {
        const readVotes = (key: string) => {
          try {
            const value = JSON.parse(localStorage.getItem(key) ?? '[]');
            return Array.isArray(value)
              ? value
                  .filter(
                    (id) =>
                      typeof id === 'string' &&
                      availableActivityIds.has(id),
                  )
                  .slice(0, MAX_VOTES)
              : [];
          } catch {
            return [];
          }
        };
        setDraftVoteIds(readVotes(`korea-trip-draft-vote:${user.id}`));
        setVotesHydratedFor(user.id);
        setSubmittedVoteIds(readVotes(`korea-trip-submitted-vote:${user.id}`));
        setFavoriteSaving(true);
        void fetch(sitePath('/api/favorites'), {
          cache: 'no-store',
          signal: controller.signal,
        })
          .then(async (response) => {
            if (response.status === 401) expireSession();
            const result = (await response.json()) as {
              user?: TripUser | null;
              favoriteIds?: string[];
              error?: string;
            };
            if (!response.ok)
              throw new Error(result.error || 'Favorites could not be loaded.');
            if (!controller.signal.aborted)
              setFavoriteIds(result.favoriteIds ?? []);
          })
          .catch((error) => {
            if (!controller.signal.aborted) setAccountError(error.message);
          })
          .finally(() => {
            if (!controller.signal.aborted) setFavoriteSaving(false);
          });
      } else setFavoriteSaving(false);
    });
    return () => {
      controller.abort();
      favoriteRequest.current?.abort();
    };
  }, [user, availableActivityIds, expireSession]);
  const restorePreferences = useCallback((votes: {
    draftVoteIds: string[];
    submittedVoteIds: string[];
  }) => {
    if (!user) return;
    localStorage.setItem(`korea-trip-draft-vote:${user.id}`, JSON.stringify(votes.draftVoteIds));
    localStorage.setItem(`korea-trip-submitted-vote:${user.id}`, JSON.stringify(votes.submittedVoteIds));
    setDraftVoteIds(votes.draftVoteIds);
    setSubmittedVoteIds(votes.submittedVoteIds);
  }, [user]);
  const { recordCategory, syncError, flushPreferences } = useMemberPreferences({
    user,
    hydrated: Boolean(user && votesHydratedFor === user.id),
    draftVoteIds,
    submittedVoteIds,
    onRestore: restorePreferences,
    onSessionExpired: expireSession,
  });
  useEffect(() => {
    const update = () => {
      setDocumentActive(document.visibilityState === 'visible');
      setVoteNow(Date.now());
    };
    let active = true;
    queueMicrotask(() => {
      if (active) update();
    });
    document.addEventListener('visibilitychange', update);
    return () => {
      active = false;
      document.removeEventListener('visibilitychange', update);
    };
  }, []);
  const filtered = useMemo(
    () =>
      activities.filter(
        (a) => displayCategory === 'all' || a.categoryId === displayCategory,
      ),
    [activities, displayCategory],
  );
  const grid = activityPage(filtered, gridPaging.page, Math.max(1, gridPaging.size));
  const visibleActivities = viewMode === 'grid'
    ? gridPaging.size ? grid.items : []
    : filtered;
  const categories = [
    ['all', 'All'],
    ...Object.entries(CATEGORIES).filter(([id]) =>
      activities.some((activity) => activity.categoryId === id),
    ),
  ];
  const focused =
    filtered.find((a) => a.id === focusedActivityId) ??
    filtered[0] ??
    activities[0];
  const detail = activities.find((a) => a.id === detailActivityId) ?? null;
  const voiceRef = useRef<TripVoiceActions | null>(null);
  const driving =
    routeResult?.activityId === detail?.id && routeResult?.origin === origin
      ? routeResult.result
      : null;
  const drivingRoute = driving?.status === 'ok' ? driving : null;
  const mapRoute = useMemo(
    () => (user && drivingRoute ? mapRouteFor(drivingRoute, routeMode) : null),
    [drivingRoute, routeMode, user],
  );
  const index = filtered.findIndex((a) => a.id === focused?.id);
  useLayoutEffect(() => {
    if (!focusAfterMove.current) return;
    cardRef.current?.focus({ preventScroll: true });
    focusAfterMove.current = false;
  }, [focused?.id]);
  const openDetail = (id: string, sourceCard?: HTMLElement | null) => {
    if (!user) {
      expireSession();
      return;
    }
    voiceRef.current?.activityOpened(id);
    setRouteResult(null);
    setRouteMode('drive');
    setDetailLeaving(false);
    closeAfterMorph.current = false;
    setBrowsePhase('ready');
    setHeadingArrived(true);
    setFocusedActivityId(id);
    const source =
      sourceCard ??
      (cardRef.current?.dataset.activityId === id ? cardRef.current : null);
    const photo = source?.querySelector<HTMLElement>('.card-image');
    const copy = source?.querySelector<HTMLElement>('.card-copy');
    const title = copy?.querySelector('h2');
    setCardFlight(
      source &&
        photo &&
        copy &&
        title &&
        !matchMedia('(prefers-reduced-motion: reduce)').matches
        ? {
            card: source.getBoundingClientRect(),
            photo: photo.getBoundingClientRect(),
            copy: copy.getBoundingClientRect(),
            title: title.getBoundingClientRect(),
            backgroundImage:
              getComputedStyle(photo).backgroundImage !== 'none'
                ? getComputedStyle(photo).backgroundImage
                : `url(${photo.querySelector('img')?.currentSrc || photo.querySelector('img')?.src || ''})`,
          }
        : null,
    );
    setDetailActivityId(id);
  };
  const closeDetail = () => {
    if (!detailActivityId || detailLeaving) return;
    if (cardFlight) {
      closeAfterMorph.current = true;
      return;
    }
    setDetailLeaving(true);
  };
  useLayoutEffect(() => {
    if (intro || !accessGranted) return;
    const target = detail ? panelRef.current : cardRef.current;
    cardAnimations.current.forEach((animation) => animation.cancel());
    cardAnimations.current = [];
    if (
      (detail && detailLeaving) ||
      (!detail && (browsePhase === 'entering' || browsePhase === 'exiting'))
    ) {
      const exiting = detailLeaving || browsePhase === 'exiting';
      const complete = () => {
        if (detailLeaving) {
          setDetailLeaving(false);
          setBrowsePhase('returning');
          setCountryArrived(false);
          setDetailActivityId(null);
        } else if (exiting) {
          setDisplayCategory(pendingCategory.current);
          setGridPaging((previous) => ({ ...previous, page: 1 }));
          setBrowsePhase('entering');
        } else
          setBrowsePhase((phase) =>
            phase === 'entering'
              ? pendingCategory.current === displayCategory
                ? 'ready'
                : 'exiting'
              : phase,
          );
      };
      if (matchMedia('(prefers-reduced-motion: reduce)').matches) {
        complete();
        return;
      }
      const surface = cardsRef.current?.getBoundingClientRect();
      const cards = [
        ...(cardsRef.current?.querySelectorAll<HTMLElement>('.activity-card') ??
          []),
      ].filter((card) => {
        if (viewMode !== 'grid' || !surface) return true;
        const bounds = card.getBoundingClientRect();
        return bounds.bottom > surface.top && bounds.top < surface.bottom;
      }).sort(
        (a, b) =>
          Math.abs(Number(a.dataset.distance)) -
            Math.abs(Number(b.dataset.distance)) ||
          Number(b.dataset.distance) - Number(a.dataset.distance),
      );
      const animations = flyCards(
        detailLeaving && target ? [target] : cards,
        exiting ? 'exit' : 'enter',
        window.innerWidth,
      );
      cardAnimations.current = animations;
      if (document.hidden) animations.forEach((animation) => animation.pause());
      let cancelled = false;
      void Promise.all(animations.map((animation) => animation.finished)).then(
        () => {
          if (!cancelled) complete();
        },
        () => {},
      );
      return () => {
        cancelled = true;
        animations.forEach((animation) => animation.cancel());
        cardAnimations.current = [];
      };
    }
    if (
      !cardFlight ||
      !target ||
      !flightSurfaceRef.current ||
      !flightPhotoRef.current ||
      !flightCopyRef.current ||
      matchMedia('(prefers-reduced-motion: reduce)').matches
    )
      return;
    const animations = morphCard(
      flightSurfaceRef.current,
      flightPhotoRef.current,
      flightCopyRef.current,
      target,
      cardFlight,
    );
    cardAnimations.current = animations;
    if (document.hidden) animations.forEach((animation) => animation.pause());
    let cancelled = false;
    void Promise.all(animations.map((animation) => animation.finished)).then(
      () => {
        if (!cancelled) {
          setCardFlight(null);
          if (closeAfterMorph.current) {
            closeAfterMorph.current = false;
            setDetailLeaving(true);
          }
        }
      },
      () => {},
    );
    return () => {
      cancelled = true;
      animations.forEach((animation) => animation.cancel());
      cardAnimations.current = [];
    };
  }, [
    intro,
    detail,
    focusedActivityId,
    browsePhase,
    cardFlight,
    detailLeaving,
    displayCategory,
    accessGranted,
    viewMode,
    grid.page,
    gridPaging.size,
  ]);
  useEffect(() => {
    for (const animation of cardAnimations.current) {
      if (animation.playState === 'finished') continue;
      if (documentActive) animation.play();
      else animation.pause();
    }
  }, [documentActive]);
  useEffect(() => {
    const preference = matchMedia('(prefers-reduced-motion: reduce)');
    const stop = () => {
      if (preference.matches) {
        setHeadingArrived(true);
        cardAnimations.current.forEach((animation) => animation.finish());
      }
    };
    let active = true;
    queueMicrotask(() => {
      if (active) stop();
    });
    preference.addEventListener('change', stop);
    return () => {
      active = false;
      preference.removeEventListener('change', stop);
    };
  }, []);
  const move = (by: number) => {
    if (browsePhase === 'exiting' || category !== displayCategory) return;
    setBrowsePhase('ready');
    if (filtered.length)
      setFocusedActivityId(
        filtered[Math.max(0, Math.min(filtered.length - 1, index + by))].id,
      );
  };
  const changeGridPage = (page: number) => {
    const next = activityPage(filtered, page, Math.max(1, gridPaging.size));
    setGridPaging((previous) => ({ ...previous, page: next.page }));
    setFocusedActivityId(next.items[0].id);
    setBrowsePhase('entering');
  };
  const toggleFavorite = async (id: string) => {
    if (!user || favoriteSaving) return;
    const controller = new AbortController();
    favoriteRequest.current = controller;
    const favorite = !favoriteIds.includes(id);
    setFavoriteSaving(true);
    setAccountError('');
    try {
      const response = await fetch(sitePath('/api/favorites'), {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ activityId: id, favorite }),
        signal: controller.signal,
      });
      if (response.status === 401) expireSession();
      const result = (await response.json()) as {
        user?: TripUser | null;
        favoriteIds?: string[];
        error?: string;
      };
      if (!response.ok)
        throw new Error(result.error || 'Your favorite could not be saved.');
      if (!controller.signal.aborted) {
        setFavoriteIds(result.favoriteIds ?? []);
        if (favorite && result.favoriteIds?.includes(id)) voiceRef.current?.selection(id);
      }
    } catch (error) {
      if (!controller.signal.aborted)
        setAccountError(
          error instanceof Error ? error.message : 'Please try again.',
        );
    } finally {
      if (!controller.signal.aborted) setFavoriteSaving(false);
    }
  };
  const logout = async () => {
    await flushPreferences();
    try {
      const response = await fetch(sitePath('/api/session'), {
        method: 'DELETE',
      });
      if (!response.ok) throw new Error('Sign out could not be completed.');
      expireSession();
    } catch (error) {
      setAccountError(
        error instanceof Error ? error.message : 'Please try again.',
      );
    }
  };
  const toggleDraft = (id: string) => {
    if (!user) return;
    // oxlint-disable-next-line react/react-compiler -- This clock read runs only in click handlers; the child action ref confuses purity inference.
    const next = remainingTime(Date.now()).expired
      ? draftVoteIds
      : draftVoteIds.includes(id)
        ? draftVoteIds.filter((x) => x !== id)
        : draftVoteIds.length < MAX_VOTES
          ? [...draftVoteIds, id]
          : draftVoteIds;
    localStorage.setItem(
      `korea-trip-draft-vote:${user.id}`,
      JSON.stringify(next),
    );
    setDraftVoteIds(next);
    if (!draftVoteIds.includes(id) && next.includes(id)) voiceRef.current?.selection(id, 'vote_added');
  };
  const openPicks = (mode: 'votes' | 'favorites' = 'votes') => {
    if (!user) return;
    returnFocus.current = document.activeElement as HTMLElement;
    setPicksMode(mode);
    setPicksOpen(true);
  };
  const closePicks = () => {
    setPicksOpen(false);
    queueMicrotask(() => returnFocus.current?.focus());
  };
  const submitVote = () => {
    if (user && draftVoteIds.length && !remainingTime(Date.now()).expired) {
      localStorage.setItem(
        `korea-trip-submitted-vote:${user.id}`,
        JSON.stringify(draftVoteIds),
      );
      setSubmittedVoteIds(draftVoteIds);
    }
  };

  return (
    <main
      tabIndex={-1}
      data-browse-phase={browsePhase}
      data-card-morph={Boolean(cardFlight)}
      data-view-mode={viewMode}
      className={`trip-shell ${intro ? 'intro-active' : 'intro-complete'} ${documentActive ? '' : 'is-inactive'}`}
      onKeyDown={(e) => {
        if (e.target instanceof Element && e.target.closest('form, dialog, .account-menu')) return;
        if (e.key === 'Escape' && picksOpen) closePicks();
        else if (detail && e.key === 'Escape') closeDetail();
      }}
    >
      <BackgroundStage
        intro={intro}
        activity={detail ?? focused}
        detailZoom={Boolean(detail)}
        mapRoute={mapRoute}
        origin={origin}
        onBrowseReady={onBrowseReady}
      />
      <header>
        <button className="wordmark" onClick={closeDetail}>
          K-trEk,{' '}
          <span>
            {'with'}
            <small className="brand-out">out</small> Shawn &amp; Sun
          </span>
        </button>
        <div className="header-actions">
          {voiceEnabled && <TripVoiceHost
            ref={voiceRef}
            user={user}
            ready={!intro && documentActive}
            activityId={detail?.id ?? focused?.id}
            onSessionExpired={expireSession}
          />}
          {user ? (
            <>
              <button
                className="picks"
                aria-label={`Favorites ${favoriteIds.length}`}
                onClick={() => openPicks('favorites')}
              >
                <Heart />
                <span className="button-label">Favorites</span>
                <b>{favoriteIds.length}</b>
              </button>
              <button
                className="picks"
                aria-label={`My picks ${draftVoteIds.length}`}
                onClick={() => openPicks('votes')}
              >
                <Users />
                <span className="button-label">My picks</span>
                <b>{draftVoteIds.length}</b>
              </button>
              {user.role === 'admin' && (
                <a
                  className="picks admin-link"
                  aria-label="Admin"
                  href={sitePath('/admin')}
                >
                  <Settings2 />
                  <span className="button-label">Admin</span>
                </a>
              )}
              <CommunityControls user={user} activities={activities} ready={!intro} onSessionExpired={expireSession} />
              <details className="account-menu">
                <summary aria-label={`Account ${user.name}`}>
                  <UserRound />
                  <span>{user.name}</span>
                </summary>
                <div>
                  <p>{user.name}</p>
                  <ReportComposer key={user.id} user={user} onSessionExpired={expireSession} />
                  <button onClick={logout}>
                    <LogOut size={16} /> Sign out
                  </button>
                </div>
              </details>
            </>
          ) : viewer === 'visitor' ? (
            <button className="picks sign-in" onClick={expireSession}>
              Sign in
            </button>
          ) : null}
        </div>
      </header>
      {accountError && (
        <p className="account-notice" role="status">
          {accountError}
        </p>
      )}
      {syncError && <p className="preference-notice" role="status">{syncError}</p>}
      {intro ? (
        <section className="intro">
          <h1>
            Choose the Korea
            <br />
            you want to remember.
          </h1>
        </section>
      ) : !accessGranted ? (
        viewer === undefined ? (
          <div className="login-stage" role="status">
            Preparing your journey…
          </div>
        ) : (
          <TripLogin
            onLogin={setViewer}
            onVisitor={() => setViewer('visitor')}
          />
        )
      ) : detail ? (
        <section className="detail-view" data-leaving={detailLeaving}>
          <button
            className="back"
            onClick={closeDetail}
            disabled={detailLeaving}
          >
            <ArrowLeft /> Back to explore
          </button>
          {cardFlight && (
            <div className="card-morph" aria-hidden="true">
              <div ref={flightSurfaceRef} className="card-morph-surface" />
              <div
                ref={flightPhotoRef}
                className="card-morph-photo"
                style={{ backgroundImage: cardFlight.backgroundImage }}
              />
              <div ref={flightCopyRef} className="card-morph-copy card-copy">
                <p>{detail.cardLocation}</p>
                <h2>{detail.title}</h2>
                <p>{detail.summary}</p>
              </div>
            </div>
          )}
          <article
            ref={panelRef}
            className="detail-panel"
            inert={detailLeaving}
          >
            <div
              className="detail-image"
              style={{
                backgroundImage: detail.image
                  ? `url(${sitePath(detail.image)})`
                  : undefined,
              }}
            >
              <span className="category-badge">{detail.category}</span>
              {!detail.image && (
                <div className="photo-pending">
                  <MapPin />
                  <p>{detail.region}</p>
                  <small>Photo reference pending</small>
                </div>
              )}
            </div>
            <div className="detail-copy">
              {detail.details.image_caption && (
                <p className="photo-caption">{detail.details.image_caption}</p>
              )}
              <p className="place">
                <MapPin /> {detail.region}, Korea
              </p>
              <h1>{detail.title}</h1>
              <p>{detail.description}</p>
              {user && (
                <div className="detail-actions">
                  <button
                    disabled={favoriteSaving}
                    aria-pressed={favoriteIds.includes(detail.id)}
                    onClick={() => toggleFavorite(detail.id)}
                  >
                    <Heart />{' '}
                    {favoriteIds.includes(detail.id) ? 'Saved' : 'Favorite'}
                  </button>
                  <button
                    className="select"
                    aria-pressed={draftVoteIds.includes(detail.id)}
                    disabled={
                      countdown.expired ||
                      (!draftVoteIds.includes(detail.id) &&
                        draftVoteIds.length >= MAX_VOTES)
                    }
                    onClick={() => toggleDraft(detail.id)}
                  >
                    <Check />{' '}
                    {draftVoteIds.includes(detail.id) ? 'Voted' : 'Vote'}
                  </button>
                </div>
              )}
              {user && (
                <>
                  <section
                    className="route"
                    aria-label={`Travel options from ${origin.name}`}
                    aria-live="polite"
                  >
                    <h2>From {origin.name}</h2>
                    <label className="route-departure" htmlFor="trip-departure">
                      Departure
                      <select
                        id="trip-departure"
                        value={departureId}
                        onChange={(event) => {
                          setDepartureId(event.target.value);
                          setRouteResult(null);
                          setRouteMode('drive');
                        }}
                      >
                        <option value="default">{initialOrigin.name}</option>
                        {TRIP_ORIGIN_PRESETS.filter(({ origin: preset }) =>
                          preset.name !== initialOrigin.name ||
                          preset.longitude !== initialOrigin.longitude ||
                          preset.latitude !== initialOrigin.latitude
                        ).map(({ id, origin: preset }) => (
                          <option key={id} value={id}>{preset.name}</option>
                        ))}
                      </select>
                    </label>
                    <dl className="route-options">
                      <div data-selected={routeMode === 'drive'}>
                        <dt>
                          <button
                            className="route-choice"
                            aria-label="Show drive route"
                            aria-pressed={routeMode === 'drive'}
                            disabled={!drivingRoute}
                            onClick={() => setRouteMode('drive')}
                          >
                            <CarFront />
                            <span>
                              Drive
                              <small>
                                {drivingRoute
                                  ? formatDistance(drivingRoute.distanceMeters)
                                  : 'Road route'}
                              </small>
                            </span>
                          </button>
                        </dt>
                        <dd>
                          <strong>
                            {drivingRoute
                              ? `${Math.max(1, Math.ceil(drivingRoute.durationSeconds / 60))} min`
                              : driving
                                ? 'Unavailable'
                                : 'Finding route…'}
                          </strong>
                          {drivingRoute && (
                            <>
                              <small>
                                Taxi estimate{' '}
                                {drivingRoute.taxiFareKrw === null
                                  ? 'unavailable'
                                  : `₩${drivingRoute.taxiFareKrw.toLocaleString('en')}`}
                              </small>
                              {drivingRoute.tollFareKrw !== null &&
                                drivingRoute.tollFareKrw > 0 && (
                                  <small>
                                    Tolls ₩
                                    {drivingRoute.tollFareKrw.toLocaleString(
                                      'en',
                                    )}
                                  </small>
                                )}
                            </>
                          )}
                        </dd>
                      </div>
                      {drivingRoute?.transitOptions.map((option) => (
                        <div
                          key={option.mode}
                          data-selected={routeMode === option.mode}
                        >
                          <dt>
                            <button
                              className="route-choice"
                              aria-label={`Show ${option.mode === 'bus_and_subway' ? 'subway and bus' : option.mode} route`}
                              aria-pressed={routeMode === option.mode}
                              onClick={() => setRouteMode(option.mode)}
                            >
                              {option.mode === 'bus' ? (
                                <BusFront />
                              ) : (
                                <TramFront />
                              )}
                              <span>
                                {option.mode === 'subway'
                                  ? 'Subway'
                                  : option.mode === 'bus'
                                    ? 'Bus'
                                    : 'Subway + bus'}
                                <small>
                                  {formatDistance(option.distanceMeters)}
                                  {option.transfers !== null
                                    ? ` · ${option.transfers} transfer${option.transfers === 1 ? '' : 's'}`
                                    : ''}
                                </small>
                              </span>
                            </button>
                          </dt>
                          <dd>
                            <strong>
                              {Math.max(
                                1,
                                Math.ceil(option.durationSeconds / 60),
                              )}{' '}
                              min
                            </strong>
                            <small>
                              {option.fareKrw === null
                                ? 'Fare unavailable'
                                : `₩${option.fareKrw.toLocaleString('en')}`}
                            </small>
                          </dd>
                        </div>
                      ))}
                      {drivingRoute && drivingRoute.transitStatus !== 'ok' && (
                        <div>
                          <dt>
                            <TramFront />
                            <span>Subway / bus</span>
                          </dt>
                          <dd>
                            <small>
                              {drivingRoute.transitStatus === 'no_route'
                                ? 'No route found'
                                : 'Temporarily unavailable'}
                            </small>
                          </dd>
                        </div>
                      )}
                    </dl>
                    {mapRoute ? (
                      <ul className="route-legend" aria-label="Route colors">
                        {[
                          ...new Set(
                            mapRoute.segments.map((segment) => segment.mode),
                          ),
                        ].map((mode) => (
                          <li key={mode}>
                            <span
                              aria-hidden="true"
                              style={{
                                backgroundColor: `rgb(${ROUTE_COLORS[mode].join(' ')})`,
                              }}
                            />
                            {mode === 'drive'
                              ? 'Drive'
                              : mode === 'bus'
                                ? 'Bus'
                                : mode === 'subway'
                                  ? 'Subway'
                                  : 'Walk'}
                          </li>
                        ))}
                      </ul>
                    ) : (
                      drivingRoute && (
                        <p className="verification-note" role="status">
                          Route geometry is unavailable for this option.
                        </p>
                      )
                    )}
                  </section>
                  {!drivingRoute && (
                    <p className="verification-note" role="status">
                      {driving?.status === 'missing_key'
                        ? 'Driving directions will be available once the server API key is connected.'
                        : driving && driving.status !== 'ok'
                          ? driving.message
                          : `Looking up the road route from ${origin.name}.`}
                    </p>
                  )}
                  {driving &&
                    driving.status !== 'ok' &&
                    driving.status !== 'missing_key' && (
                      <button
                        className="route-retry"
                        onClick={() => {
                          setRouteResult(null);
                          setRouteAttempt((attempt) => attempt + 1);
                        }}
                      >
                        Retry directions
                      </button>
                    )}
                </>
              )}
              {(detail.categoryId !== 'food' ||
                detail.details.operator_duration_minutes !== null) && (
                <div className="facts">
                  <span>
                    <Clock3 /> {detail.duration}
                  </span>
                  <span>
                    {detail.details.operator_duration_minutes === null
                      ? 'Suggested stay'
                      : 'Operator program'}
                  </span>
                </div>
              )}
              {detail.mapIsIllustrative && (
                <p className="verification-note">
                  Illustrative map position · exact coordinates not verified
                </p>
              )}
              {!detail.mapFocus && (
                <p className="verification-note">
                  {detail.regionId === 'seoul'
                    ? 'Seoul area shown · exact venue coordinates not assigned.'
                    : 'Exact location to be confirmed.'}
                </p>
              )}
              <HostReviews
                key={detail.id}
                activity={detail}
                canEdit={user?.role === 'admin'}
                onSaved={(reviews) => {
                  setActivities((items) => items.map((activity) =>
                    activity.id === detail.id
                      ? toActivity({ ...activity.details, ...reviews })
                      : activity,
                  ));
                }}
              />
              <ActivityInformation activity={detail} />
            </div>
          </article>
        </section>
      ) : browsePhase === 'returning' ? (
        <div className="return-stage" role="status">
          <span className="sr-only">Moving to the Korea map.</span>
        </div>
      ) : (
        <section className="explore">
          <div className="heading" data-arriving={!headingArrived}>
            <h1 aria-label="What makes you excited?">
              {'What makes you excited?'.split(' ').map((word, order) => (
                <Fragment key={word}>
                  {order > 0 ? ' ' : null}
                  <span
                    className="title-word"
                    aria-hidden="true"
                    style={{ animationDelay: `${order * 55}ms` }}
                    onAnimationEnd={
                      order === 3 ? () => setHeadingArrived(true) : undefined
                    }
                  >
                    {word}
                  </span>
                </Fragment>
              ))}
            </h1>
          </div>
          <div className="browse-filters">
            <nav aria-label="Filter activities">
              {categories.map(([id, label]) => (
                <button
                  key={id}
                  aria-pressed={category === id}
                  onClick={() => {
                    if (category === id) return;
                    pendingCategory.current = id;
                    recordCategory(id);
                    setCategory(id);
                    if (
                      matchMedia('(prefers-reduced-motion: reduce)').matches
                    ) {
                      setDisplayCategory(id);
                      setGridPaging((previous) => ({ ...previous, page: 1 }));
                      setBrowsePhase('ready');
                    } else if (browsePhase !== 'entering')
                      setBrowsePhase('exiting');
                  }}
                >
                  {label}
                </button>
              ))}
            </nav>
            <div className="view-toggle" role="group" aria-label="Activity view">
              {(['list', 'grid'] as const).map((mode) => (
                <button
                  key={mode}
                  type="button"
                  aria-label={mode === 'grid' ? 'Grid view' : 'List view'}
                  title={mode === 'grid' ? 'Grid view' : 'List view'}
                  aria-pressed={viewMode === mode}
                  onClick={() => {
                    if (viewMode === mode) return;
                    setViewMode(mode);
                    if (mode === 'grid') setGridPaging((previous) => ({
                      ...previous,
                      page: Math.floor(index / Math.max(1, previous.size)) + 1,
                    }));
                    setBrowsePhase('entering');
                  }}
                >
                  {mode === 'grid' ? <LayoutGrid size={18} /> : <List size={18} />}
                </button>
              ))}
            </div>
          </div>
          {filtered.length ? (
            <div className={`carousel ${viewMode === 'grid' ? 'grid-carousel' : ''}`}>
              <div
                ref={bindCards}
                className={viewMode === 'grid' ? 'activity-grid' : 'cards'}
                inert={
                  browsePhase === 'exiting' || category !== displayCategory
                }
                aria-label={viewMode === 'grid' ? 'Activities grid' : 'Swipe through activities'}
                onPointerDown={(e) => {
                  if (viewMode !== 'list') return;
                  dragStart.current = e.clientX;
                  dragged.current = false;
                }}
                onPointerUp={(e) => {
                  if (viewMode !== 'list') return;
                  if (dragStart.current === null) return;
                  const distance = e.clientX - dragStart.current;
                  dragStart.current = null;
                  if (Math.abs(distance) > 44) {
                    dragged.current = true;
                    move(distance < 0 ? 1 : -1);
                    setTimeout(() => {
                      dragged.current = false;
                    }, 0);
                  }
                }}
                onWheel={(e) => {
                  if (viewMode !== 'list' || e.ctrlKey) return;
                  wheelGesture.current ??= carouselWheelGesture();
                  const by = wheelGesture.current(e);
                  if (by) move(by);
                }}
              >
                {viewMode === 'grid' && gridPaging.size === 0 && (
                  <p className="grid-fit-notice" role="status">
                    Use List view or a taller window to see complete cards.
                  </p>
                )}
                {visibleActivities.map((a, i) => {
                  const distance = i + (viewMode === 'grid' ? grid.start : 0) - index;
                  if (viewMode === 'list' && Math.abs(distance) > 2) return null;
                  const selected = !distance;
                  return (
                    <article
                      key={a.id}
                      ref={selected ? cardRef : null}
                      className="activity-card"
                      data-activity-id={a.id}
                      data-distance={Math.max(-2, Math.min(2, distance))}
                      aria-current={selected}
                      tabIndex={selected ? 0 : -1}
                      onClick={(e) => {
                        if (dragged.current) {
                          dragged.current = false;
                          return;
                        }
                        if (!user) {
                          expireSession();
                          return;
                        }
                        if (viewMode === 'grid' || selected)
                          openDetail(a.id, e.currentTarget);
                        else {
                          setBrowsePhase('ready');
                          setFocusedActivityId(a.id);
                        }
                      }}
                      onKeyDown={(e) => {
                        if (e.target !== e.currentTarget) return;
                        if (viewMode === 'list' && !selected) return;
                        if (viewMode === 'list' && (e.key === 'ArrowLeft' || e.key === 'ArrowRight')) {
                          e.preventDefault();
                          focusAfterMove.current = true;
                          move(e.key === 'ArrowLeft' ? -1 : 1);
                        } else if (e.key === 'Enter' || e.key === ' ') {
                          e.preventDefault();
                          openDetail(a.id);
                        }
                      }}
                    >
                      <div
                        className="card-image"
                      >
                        {a.image && (
                          <Image
                            src={sitePath(a.image)}
                            alt={a.details.image_caption || a.title}
                            width={600}
                            height={400}
                            unoptimized
                            loading="lazy"
                            className="card-photo"
                          />
                        )}
                        {!a.image && (
                          <div className="photo-pending">
                            <MapPin />
                            <p>{a.region}</p>
                            <small>Photo reference pending</small>
                          </div>
                        )}
                        {user && (
                          <button
                            className="heart"
                            disabled={favoriteSaving}
                            tabIndex={viewMode === 'grid' || selected ? 0 : -1}
                            aria-label={`Favorite ${a.title}`}
                            aria-pressed={favoriteIds.includes(a.id)}
                            onClick={(e) => {
                              e.stopPropagation();
                              void toggleFavorite(a.id);
                            }}
                          >
                            <Heart />
                          </button>
                        )}
                        {a.details.image_caption?.startsWith(
                          'Area context',
                        ) && (
                          <small className="photo-context">
                            Area context photo
                          </small>
                        )}
                        <span className="category-badge">{a.category}</span>
                      </div>
                      <div className="card-copy">
                        <p>{a.cardLocation}</p>
                        <h2>{a.title}</h2>
                        <p>{a.summary}</p>
                        <div>
                          {(a.categoryId !== 'food' ||
                            a.details.operator_duration_minutes !== null) && (
                            <span>
                              <Clock3 /> {a.duration}
                            </span>
                          )}
                          <button
                            tabIndex={viewMode === 'grid' || selected ? 0 : -1}
                            onClick={(e) => {
                              e.stopPropagation();
                              openDetail(
                                a.id,
                                e.currentTarget.closest<HTMLElement>(
                                  '.activity-card',
                                ),
                              );
                            }}
                          >
                            {user ? 'Details' : 'Sign in'} <ArrowRight />
                          </button>
                        </div>
                      </div>
                    </article>
                  );
                })}
              </div>
              <p className="sr-only" aria-live="polite">
                Focused activity: {focused?.title ?? 'No activities'}
              </p>
            </div>
          ) : (
            <div className="empty">
              {activities.length
                ? 'No activities match. '
                : 'No activities are available yet.'}
              {activities.length > 0 && (
                <button
                      onClick={() => {
                    setCategory('all');
                  }}
                >
                  Clear filters
                </button>
              )}
            </div>
          )}
          <footer>
            {viewMode === 'grid' && (
              <nav className="grid-pagination" aria-label="Activity pages" data-empty={grid.pageCount <= 1 || gridPaging.size === 0}>
                <button
                  type="button"
                  aria-label="Previous page"
                  disabled={grid.page === 1 || browsePhase === 'exiting' || category !== displayCategory}
                  onClick={() => changeGridPage(grid.page - 1)}
                >
                  <ArrowLeft size={16} />
                </button>
                <span role="status" aria-live="polite" aria-atomic="true">
                  Page {grid.page} of {grid.pageCount}
                </span>
                <button
                  type="button"
                  aria-label="Next page"
                  disabled={grid.page === grid.pageCount || browsePhase === 'exiting' || category !== displayCategory}
                  onClick={() => changeGridPage(grid.page + 1)}
                >
                  <ArrowRight size={16} />
                </button>
              </nav>
            )}
            <div className="vote-countdown">
              <span>
                {countdown.expired
                  ? 'Voting closed'
                  : 'Voting closes Jan 15, 2027 · ET'}
              </span>
              <AnimatedCountdown
                value={formatCountdown(countdown)}
                dateTime={VOTE_DEADLINE_ISO}
                active={documentActive}
              />
            </div>
            {user && (
              <button
                className="vote"
                disabled={!draftVoteIds.length || countdown.expired}
                onClick={() => openPicks('votes')}
              >
                Review vote{' '}
                <span>
                  {draftVoteIds.length}/{MAX_VOTES}
                </span>
              </button>
            )}
          </footer>
        </section>
      )}
      <footer className="app-version" aria-label="Application version">
        v{appVersion}
      </footer>
      {picksOpen && user && (
        <div
          className="backdrop"
          onMouseDown={(e) => e.target === e.currentTarget && closePicks()}
        >
          <aside
            role="dialog"
            aria-modal="true"
            aria-labelledby="picks-title"
            onKeyDown={(e) => {
              if (e.key !== 'Tab') return;
              const controls = Array.from(
                e.currentTarget.querySelectorAll<HTMLElement>(
                  'button:not(:disabled), input:not(:disabled)',
                ),
              );
              const edge = e.shiftKey ? controls[0] : controls.at(-1);
              if (controls.length && document.activeElement === edge) {
                e.preventDefault();
                (e.shiftKey ? controls.at(-1) : controls[0])?.focus();
              }
            }}
          >
            <button
              autoFocus
              className="close"
              aria-label="Close picks"
              onClick={closePicks}
            >
              <X />
            </button>
            <p className="drawer-label">
              {picksMode === 'favorites'
                ? 'Saved with a heart'
                : 'Your vote draft'}
            </p>
            <h2 id="picks-title">
              {picksMode === 'favorites'
                ? 'Your favorites.'
                : `Choose up to ${MAX_VOTES} activities.`}
            </h2>
            <p>
              {picksMode === 'favorites'
                ? 'Open a saved place to see its details.'
                : 'Each selected activity gets one vote in your draft.'}
            </p>
            <div className="picked-list">
              {(picksMode === 'favorites' ? favoriteIds : draftVoteIds)
                .length ? (
                (picksMode === 'favorites' ? favoriteIds : draftVoteIds).map(
                  (id) => {
                    const a = activities.find((x) => x.id === id);
                    if (!a) return null;
                    return (
                      <div key={id}>
                        <span
                          style={{
                            backgroundImage: a.image
                              ? `url(${sitePath(a.image)})`
                              : undefined,
                          }}
                        />
                        <div>
                          <button
                            className="picked-open"
                            onClick={() => {
                              closePicks();
                              openDetail(id);
                            }}
                          >
                            {a.title}
                          </button>
                          <small>{a.cardLocation}</small>
                        </div>
                        <button
                          aria-label={`Remove ${a.title}`}
                          disabled={
                            picksMode === 'favorites'
                              ? favoriteSaving
                              : countdown.expired
                          }
                          onClick={() =>
                            picksMode === 'favorites'
                              ? void toggleFavorite(id)
                              : toggleDraft(id)
                          }
                        >
                          <X />
                        </button>
                      </div>
                    );
                  },
                )
              ) : (
                <div className="drawer-empty">
                  {picksMode === 'favorites'
                    ? 'Tap a heart on a card to save it here.'
                    : 'Open an activity and vote to add it here.'}
                </div>
              )}
            </div>
            {picksMode === 'votes' && submittedVoteIds.length > 0 && (
              <p className="submitted" aria-live="polite">
                <Check /> Demo vote submitted for {submittedVoteIds.length}{' '}
                activities.
              </p>
            )}
            {picksMode === 'votes' && (
              <button
                className="submit"
                disabled={!draftVoteIds.length || countdown.expired}
                onClick={submitVote}
              >
                Submit vote <ArrowRight />
              </button>
            )}
            <button className="keep" onClick={closePicks}>
              Keep exploring
            </button>
          </aside>
        </div>
      )}
    </main>
  );
}
