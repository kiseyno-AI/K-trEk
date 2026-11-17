import type {
  DrivingRoute,
  DrivingRouteErrorStatus,
  DrivingRouteResponse,
  TransitOption,
  TransitStatus,
  RouteSegment,
} from './driving-route';
import {
  DEFAULT_TRIP_ORIGIN,
  parseTripOrigin,
  resolveTripOrigin,
  type TripOrigin,
} from './trip-origin.ts';

type Destination = {
  id: string;
  published: boolean;
  coordinate_status: string;
  longitude: number | null;
  latitude: number | null;
};
type Dependencies = {
  findActivity: (id: string) => Promise<Destination | null>;
  getApiKey: () => string | undefined;
  getOrigin?: () => TripOrigin;
  fetch?: typeof fetch;
  now?: () => number;
  timeoutMs?: number;
};

type Result = {
  status: number;
  body: DrivingRouteResponse;
  retryAfter?: number;
};
const messages: Record<DrivingRouteErrorStatus, string> = {
  missing_key: 'Driving directions are not configured yet.',
  no_route: 'No driving route is available for this destination.',
  rate_limited: 'Driving directions are busy. Please try again shortly.',
  upstream_error: 'Driving directions are temporarily unavailable.',
  invalid_destination:
    'Driving directions are unavailable for this destination.',
};
const failure = (
  status: DrivingRouteErrorStatus,
  httpStatus: number,
): Result => ({
  status: httpStatus,
  body: { status, message: messages[status] },
});
const reply = (result: Result) =>
  Response.json(result.body, {
    status: result.status,
    headers: {
      'Cache-Control': 'no-store',
      'X-Content-Type-Options': 'nosniff',
      ...(result.retryAfter
        ? { 'Retry-After': String(result.retryAfter) }
        : {}),
    },
  });
const object = (value: unknown): Record<string, unknown> | null =>
  typeof value === 'object' && value !== null && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : null;
const validCoordinate = (longitude: unknown, latitude: unknown) =>
  typeof longitude === 'number' &&
  Number.isFinite(longitude) &&
  longitude >= -180 &&
  longitude <= 180 &&
  typeof latitude === 'number' &&
  Number.isFinite(latitude) &&
  latitude >= -90 &&
  latitude <= 90;
const fareAmount = (value: unknown): number | null =>
  typeof value === 'number' && Number.isSafeInteger(value) && value >= 0
    ? value
    : null;
type TransitResult = Pick<
  DrivingRoute,
  'transitOptions' | 'transitStatus' | 'transitMessage'
>;
const transitFailure = (
  status: Exclude<TransitStatus, 'ok'>,
): TransitResult => ({
  transitOptions: [],
  transitStatus: status,
  transitMessage: {
    unavailable: 'Public transport directions are currently unavailable.',
    no_route: 'No public transport route is available for this destination.',
    rate_limited:
      'Public transport directions are busy. Please try again shortly.',
    upstream_error: 'Public transport directions are temporarily unavailable.',
  }[status],
});

function normalize(
  input: unknown,
  activityId: string,
  now: number,
  origin: TripOrigin,
): Result {
  const routes = object(input)?.routes;
  if (!Array.isArray(routes)) throw new Error('Invalid route envelope');
  if (!routes.length) return failure('no_route', 422);
  const route = object(routes[0]);
  if (
    typeof route?.result_code === 'number' &&
    [1, 101, 102, 103, 104, 105, 106, 107].includes(route.result_code)
  )
    return failure('no_route', 422);
  if (route?.result_code !== 0) throw new Error('Invalid route result');
  const summary = object(route.summary);
  const distance = summary?.distance,
    duration = summary?.duration;
  if (
    typeof distance !== 'number' ||
    !Number.isSafeInteger(distance) ||
    distance < 0 ||
    typeof duration !== 'number' ||
    !Number.isSafeInteger(duration) ||
    duration < 0 ||
    !Array.isArray(route.sections)
  )
    throw new Error('Invalid route summary');
  const path: [number, number][] = [];
  let vertices = 0;
  for (const section of route.sections) {
    const roads = object(section)?.roads;
    if (!Array.isArray(roads)) throw new Error('Missing road geometry');
    for (const road of roads) {
      const points = object(road)?.vertexes;
      if (!Array.isArray(points) || points.length < 2 || points.length % 2)
        throw new Error('Invalid road vertices');
      vertices += points.length / 2;
      if (vertices > 50000) throw new Error('Route exceeds vertex limit');
      for (let index = 0; index < points.length; index += 2) {
        const longitude = points[index],
          latitude = points[index + 1];
        if (!validCoordinate(longitude, latitude))
          throw new Error('Invalid route coordinate');
        const previous = path[path.length - 1];
        if (!previous || previous[0] !== longitude || previous[1] !== latitude)
          path.push([longitude, latitude]);
      }
    }
  }
  if (path.length < 2) throw new Error('Missing route geometry');
  const fare = object(summary?.fare);
  return {
    status: 200,
    body: {
      status: 'ok',
      activityId,
      origin,
      provider: 'kakao',
      path,
      distanceMeters: distance,
      durationSeconds: duration,
      taxiFareKrw: fareAmount(fare?.taxi),
      tollFareKrw: fareAmount(fare?.toll),
      ...transitFailure('unavailable'),
      fetchedAt: new Date(now).toISOString(),
    },
  };
}

async function readProviderJson(
  response: Response,
  signal: AbortSignal,
): Promise<unknown> {
  const limit = 2 * 1024 * 1024;
  if (Number(response.headers.get('content-length')) > limit) {
    void response.body?.cancel().catch(() => {});
    throw new Error('Route exceeds byte limit');
  }
  if (!response.body) throw new Error('Missing route body');
  const reader = response.body.getReader();
  const cancel = () => {
    void reader.cancel().catch(() => {});
  };
  signal.addEventListener('abort', cancel, { once: true });
  const decoder = new TextDecoder();
  let bytes = 0,
    text = '';
  try {
    while (!signal.aborted) {
      const { done, value } = await reader.read();
      if (done) break;
      bytes += value.byteLength;
      if (bytes > limit) {
        cancel();
        throw new Error('Route exceeds byte limit');
      }
      text += decoder.decode(value, { stream: true });
    }
    if (signal.aborted) throw new Error('Route request stopped');
    return JSON.parse(text + decoder.decode());
  } finally {
    signal.removeEventListener('abort', cancel);
    reader.releaseLock();
  }
}

function transitSegments(input: unknown): RouteSegment[] {
  if (!Array.isArray(input) || !input.length || input.length > 256) return [];
  const modes: Record<string, RouteSegment['mode']> = {
    BUS: 'bus',
    SUBWAY: 'subway',
    WALKING: 'walk',
  };
  const segments: RouteSegment[] = [];
  let vertices = 0;
  for (const step of input) {
    const value = object(step);
    const type = object(value?.properties)?.type;
    const points = object(value?.path)?.points;
    if (
      typeof type !== 'string' ||
      !Object.hasOwn(modes, type) ||
      !Array.isArray(points) ||
      points.length < 2
    )
      return [];
    vertices += points.length;
    if (vertices > 50000) return [];
    const path: [number, number][] = [];
    for (const point of points) {
      if (
        !Array.isArray(point) ||
        point.length !== 2 ||
        !validCoordinate(point[0], point[1])
      )
        return [];
      const previous = path[path.length - 1];
      if (!previous || previous[0] !== point[0] || previous[1] !== point[1])
        path.push([point[0], point[1]]);
    }
    if (path.length < 2) return [];
    segments.push({ mode: modes[type], path });
  }
  return segments;
}

function normalizeTransit(input: unknown): TransitResult {
  const body = object(input);
  if (
    ['NO_RESULTS', 'STARTNODES_NULL', 'ENDNODES_NULL', 'EQUAL_POINTS'].includes(
      String(body?.status),
    )
  )
    return transitFailure('no_route');
  if (body?.status !== 'OK' || !Array.isArray(body.routes))
    return transitFailure('upstream_error');
  const modes: Record<string, TransitOption['mode']> = {
    BUS: 'bus',
    SUBWAY: 'subway',
    BUS_AND_SUBWAY: 'bus_and_subway',
  };
  const options = new Map<TransitOption['mode'], TransitOption>();
  for (const route of body.routes) {
    const properties = object(object(route)?.properties);
    const type = properties?.type;
    const mode =
      typeof type === 'string' && Object.hasOwn(modes, type)
        ? modes[type]
        : null;
    const duration = fareAmount(properties?.totalTime),
      distance = fareAmount(properties?.totalDistance);
    if (!mode || duration === null || distance === null) continue;
    const option: TransitOption = {
      mode,
      durationSeconds: duration,
      distanceMeters: distance,
      fareKrw: fareAmount(object(properties?.fare)?.value),
      transfers: fareAmount(properties?.transfers),
      segments: transitSegments(object(route)?.steps),
    };
    const previous = options.get(mode);
    if (!previous || duration < previous.durationSeconds)
      options.set(mode, option);
  }
  if (!options.size)
    return transitFailure(body.routes.length ? 'upstream_error' : 'no_route');
  return {
    transitOptions: [...options.values()],
    transitStatus: 'ok',
    transitMessage: null,
  };
}

async function requestTransit(
  destination: Destination,
  origin: TripOrigin,
  key: string,
  fetchRoute: typeof fetch,
  signal: AbortSignal,
): Promise<TransitResult> {
  if (signal.aborted) return transitFailure('upstream_error');
  const controller = new AbortController();
  let onAbort: () => void = () => {};
  const stopped = new Promise<TransitResult>((resolve) => {
    onAbort = () => resolve(transitFailure('upstream_error'));
    controller.signal.addEventListener('abort', onAbort, { once: true });
  });
  const abort = () => controller.abort();
  signal.addEventListener('abort', abort, { once: true });
  const timeout = setTimeout(abort, 4000);
  const perform = async (): Promise<TransitResult> => {
    const url = new URL('https://dapi.kakao.com/v2/routing/publictraffic');
    for (const [name, value] of Object.entries({
      start_x: String(origin.longitude),
      start_y: String(origin.latitude),
      end_x: String(destination.longitude),
      end_y: String(destination.latitude),
      input_coord: 'WGS84',
      output_coord: 'WGS84',
    }))
      url.searchParams.set(name, value);
    const response = await fetchRoute(url, {
      headers: { Authorization: `KakaoAK ${key}`, Accept: 'application/json' },
      redirect: 'manual',
      cache: 'no-store',
      signal: controller.signal,
    });
    if (
      response.status === 401 ||
      response.status === 403 ||
      response.status === 429 ||
      (response.status >= 300 && response.status < 400)
    ) {
      void response.body?.cancel().catch(() => {});
      return transitFailure(
        response.status === 403 || response.status === 401
          ? 'unavailable'
          : response.status === 429
            ? 'rate_limited'
            : 'upstream_error',
      );
    }
    const body = await readProviderJson(response, controller.signal);
    if (object(body)?.code === -10) return transitFailure('rate_limited');
    if (!response.ok) return transitFailure('upstream_error');
    return normalizeTransit(body);
  };
  try {
    return await Promise.race([perform(), stopped]);
  } catch {
    return transitFailure('upstream_error');
  } finally {
    clearTimeout(timeout);
    signal.removeEventListener('abort', abort);
    controller.signal.removeEventListener('abort', onAbort);
  }
}

async function requestRoute(
  destination: Destination,
  origin: TripOrigin,
  key: string,
  fetchRoute: typeof fetch,
  now: () => number,
  timeoutMs: number,
  controller: AbortController,
  reserveTransit: () => boolean,
): Promise<Result> {
  let timedOut = false;
  const timeout = setTimeout(() => {
    timedOut = true;
    controller.abort();
  }, timeoutMs);
  let stopped: () => void = () => {};
  const aborted = new Promise<never>((_resolve, reject) => {
    stopped = () => reject(new Error('Route request stopped'));
    controller.signal.addEventListener('abort', stopped, { once: true });
  });
  const perform = async (): Promise<Result> => {
    const url = new URL('https://apis-navi.kakaomobility.com/v1/directions');
    url.searchParams.set('origin', `${origin.longitude},${origin.latitude}`);
    url.searchParams.set(
      'destination',
      `${destination.longitude},${destination.latitude}`,
    );
    url.searchParams.set('priority', 'RECOMMEND');
    url.searchParams.set('alternatives', 'false');
    url.searchParams.set('summary', 'false');
    const response = await fetchRoute(url, {
      headers: {
        Authorization: `KakaoAK ${key}`,
        Accept: 'application/json',
        'Content-Type': 'application/json',
      },
      redirect: 'manual',
      cache: 'no-store',
      signal: controller.signal,
    });
    if (response.status >= 300 && response.status < 400) {
      void response.body?.cancel().catch(() => {});
      return failure('upstream_error', 502);
    }
    if (response.status === 429) {
      void response.body?.cancel().catch(() => {});
      return { ...failure('rate_limited', 429), retryAfter: 60 };
    }
    const body = await readProviderJson(response, controller.signal);
    if (object(body)?.code === -10)
      return { ...failure('rate_limited', 429), retryAfter: 60 };
    if (!response.ok) return failure('upstream_error', 502);
    return normalize(body, destination.id, now(), origin);
  };
  try {
    const result = await Promise.race([perform(), aborted]);
    if (result.body.status !== 'ok') return result;
    const transit = controller.signal.aborted
      ? transitFailure('upstream_error')
      : reserveTransit()
        ? await requestTransit(
            destination,
            origin,
            key,
            fetchRoute,
            controller.signal,
          )
        : transitFailure('rate_limited');
    return { ...result, body: { ...result.body, ...transit } };
  } catch {
    return failure('upstream_error', timedOut ? 504 : 502);
  } finally {
    clearTimeout(timeout);
    controller.signal.removeEventListener('abort', stopped);
  }
}

export function createKakaoDirectionsHandler(dependencies: Dependencies) {
  const fetchRoute = dependencies.fetch ?? fetch;
  const now = dependencies.now ?? Date.now;
  type Pending = {
    controller: AbortController;
    promise: Promise<Result>;
    readers: number;
    settled: boolean;
  };
  const pending = new Map<string, Pending>();
  let starts: number[] = [];
  const reserveCall = () => {
    const time = now();
    starts = starts.filter((started) => started > time - 60000);
    if (starts.length >= 20) return false;
    starts.push(time);
    return true;
  };
  const waitForRoute = async (
    entry: Pending,
    routeKey: string,
    signal: AbortSignal,
  ) => {
    entry.readers += 1;
    let onAbort: () => void = () => {};
    try {
      return await new Promise<Result>((resolve) => {
        onAbort = () => resolve(failure('upstream_error', 503));
        signal.addEventListener('abort', onAbort, { once: true });
        if (signal.aborted) onAbort();
        void entry.promise.then(resolve);
      });
    } finally {
      signal.removeEventListener('abort', onAbort);
      entry.readers -= 1;
      if (!entry.readers && !entry.settled) {
        entry.controller.abort();
        if (pending.get(routeKey) === entry) pending.delete(routeKey);
      }
    }
  };
  return async (request: Request, id: string): Promise<Response> => {
    if (!/^[a-z0-9][a-z0-9-]{0,79}$/.test(id))
      return reply(failure('invalid_destination', 404));
    if (request.signal.aborted) return reply(failure('upstream_error', 503));
    try {
      const destination = await dependencies.findActivity(id);
      if (!destination || !destination.published || destination.id !== id)
        return reply(failure('invalid_destination', 404));
      if (
        destination.coordinate_status !== 'verified' ||
        !validCoordinate(destination.longitude, destination.latitude)
      )
        return reply(failure('invalid_destination', 422));
      const key = dependencies.getApiKey()?.trim();
      if (!key) return reply(failure('missing_key', 503));
      if (request.signal.aborted) return reply(failure('upstream_error', 503));
      const configuredOrigin = parseTripOrigin(
        dependencies.getOrigin ? dependencies.getOrigin() : DEFAULT_TRIP_ORIGIN,
      );
      let origin: TripOrigin;
      try {
        origin = resolveTripOrigin(
          new URL(request.url).searchParams.get('origin'),
          configuredOrigin,
        );
      } catch {
        return reply({
          status: 400,
          body: {
            status: 'invalid_destination',
            message: 'Choose a listed departure.',
          },
        });
      }
      const routeKey = `${id}:${destination.longitude},${destination.latitude}:${origin.longitude},${origin.latitude}:${origin.name}`;
      let entry = pending.get(routeKey);
      if (!entry) {
        // shortcut: limits are per isolate; use a durable limiter when traffic needs a shared hard quota.
        if (pending.size >= 4 || !reserveCall())
          return reply({ ...failure('rate_limited', 429), retryAfter: 60 });
        const controller = new AbortController();
        const created: Pending = {
          controller,
          readers: 0,
          settled: false,
          promise: requestRoute(
            destination,
            origin,
            key,
            fetchRoute,
            now,
            dependencies.timeoutMs ?? 8000,
            controller,
            reserveCall,
          ).finally(() => {
            created.settled = true;
            if (pending.get(routeKey) === created) pending.delete(routeKey);
          }),
        };
        pending.set(routeKey, created);
        entry = created;
      }
      return reply(await waitForRoute(entry, routeKey, request.signal));
    } catch {
      return reply(failure('upstream_error', 502));
    }
  };
}
