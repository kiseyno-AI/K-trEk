import type {
  DrivingRoute,
  RouteSegment,
  TransitOption,
} from './driving-route';

export const ROUTE_COLORS = {
  drive: [255, 138, 92],
  bus: [82, 215, 255],
  subway: [196, 161, 255],
  walk: [198, 210, 208],
} as const;

export type RouteMode = 'drive' | TransitOption['mode'];
export type MapRoute = {
  activityId: string;
  provider: 'kakao';
  mode: RouteMode;
  segments: RouteSegment[];
};

export function mapRouteFor(
  route: DrivingRoute,
  mode: RouteMode,
): MapRoute | null {
  const segments =
    mode === 'drive'
      ? [{ mode: 'drive' as const, path: route.path }]
      : (route.transitOptions.find((option) => option.mode === mode)
          ?.segments ?? []);
  if (!segments.length) return null;
  return {
    activityId: route.activityId,
    provider: route.provider,
    mode,
    segments,
  };
}

export function routeMesh(segments: RouteSegment[]) {
  const groups = new Map<
    RouteSegment['mode'],
    ReturnType<typeof routeRibbon>[]
  >();
  for (const segment of segments) {
    const ribbons = groups.get(segment.mode) ?? [];
    ribbons.push(routeRibbon(segment.path));
    groups.set(segment.mode, ribbons);
  }
  const size = [...groups.values()]
    .flat()
    .reduce((sum, ribbon) => sum + ribbon.vertices.length, 0);
  const vertices = new Float32Array(size);
  const ranges: {
    mode: RouteSegment['mode'];
    start: number;
    count: number;
    lengthKm: number;
  }[] = [];
  let offset = 0;
  // Separate legs stay separate triangles; grouping limits rendering to four mode batches.
  for (const [mode, ribbons] of groups) {
    const start = offset / 8;
    let lengthKm = 0;
    for (const ribbon of ribbons) {
      vertices.set(ribbon.vertices, offset);
      offset += ribbon.vertices.length;
      lengthKm += ribbon.lengthKm;
    }
    ranges.push({ mode, start, count: offset / 8 - start, lengthKm });
  }
  return { vertices, ranges };
}

export function routeRibbon(path: readonly (readonly number[])[]) {
  const vertices: number[] = [];
  const radians = Math.PI / 180;
  let lengthKm = 0;
  for (let index = 1; index < path.length; index += 1) {
    const a = path[index - 1],
      b = path[index];
    const h =
      Math.sin(((b[1] - a[1]) * radians) / 2) ** 2 +
      Math.cos(a[1] * radians) *
        Math.cos(b[1] * radians) *
        Math.sin(((b[0] - a[0]) * radians) / 2) ** 2;
    const distance = 12742 * Math.asin(Math.sqrt(Math.min(1, h)));
    if (distance < 1e-8) continue;
    for (const [end, side] of [
      [0, -1],
      [1, -1],
      [1, 1],
      [0, -1],
      [1, 1],
      [0, 1],
    ])
      vertices.push(
        a[0],
        a[1],
        b[0],
        b[1],
        end,
        side,
        lengthKm,
        lengthKm + distance,
      );
    lengthKm += distance;
  }
  return { vertices: new Float32Array(vertices), lengthKm };
}
