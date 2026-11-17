import { DEFAULT_TRIP_ORIGIN } from './trip-origin.ts';

export type Camera = {
  longitude: number;
  latitude: number;
  radius: number;
  anchorX: number;
  anchorY: number;
};

export const SEOUL_STATION = DEFAULT_TRIP_ORIGIN;

export function lightStyleForZoom(radius: number) {
  const progress = Math.max(0, Math.min(1, (radius - 24) / 176));
  const detail = progress * progress * (3 - 2 * progress);
  return { pointSize: 10 + 12 * detail, strengthBoost: 0.25 * detail };
}

type LabelRect = { x: number; y: number; width: number; height: number };
type Point = { x: number; y: number };
type LabelFrame = { left: number; top: number; right: number; bottom: number };

export function placeJourneyLabels(
  origin: LabelRect,
  destination: LabelRect,
  frame: LabelFrame,
  paths: readonly (readonly Point[])[],
): [LabelRect, LabelRect] {
  const overlaps = (a: LabelRect, b: LabelRect, gap = 8) =>
    a.x < b.x + b.width + gap &&
    a.x + a.width + gap > b.x &&
    a.y < b.y + b.height + gap &&
    a.y + a.height + gap > b.y;
  const crosses = (box: LabelRect, a: Point, b: Point) => {
    const left = box.x - 6,
      right = box.x + box.width + 6;
    const top = box.y - 6,
      bottom = box.y + box.height + 6;
    if (
      Math.max(a.x, b.x) < left ||
      Math.min(a.x, b.x) > right ||
      Math.max(a.y, b.y) < top ||
      Math.min(a.y, b.y) > bottom
    )
      return false;
    let first = 0,
      last = 1;
    const dx = b.x - a.x,
      dy = b.y - a.y;
    if (dx !== 0) {
      const x0 = (left - a.x) / dx,
        x1 = (right - a.x) / dx;
      first = Math.max(first, Math.min(x0, x1));
      last = Math.min(last, Math.max(x0, x1));
    }
    if (dy !== 0) {
      const y0 = (top - a.y) / dy,
        y1 = (bottom - a.y) / dy;
      first = Math.max(first, Math.min(y0, y1));
      last = Math.min(last, Math.max(y0, y1));
    }
    return first <= last;
  };
  const candidates = (anchor: LabelRect) => {
    const { x, y, width, height } = anchor;
    const positions = [
      [x + 16, y - height - 16],
      [x - width - 16, y - height - 16],
      [x + 16, y + 16],
      [x - width - 16, y + 16],
      [x - width / 2, y - height - 16],
      [x - width / 2, y + 16],
      [x + 16, y - height / 2],
      [x - width - 16, y - height / 2],
      [frame.left, frame.top],
      [frame.right - width, frame.top],
      [frame.left, frame.bottom - height],
      [frame.right - width, frame.bottom - height],
    ];
    return positions.map(([left, top]) => {
      const box = {
        x: Math.max(frame.left, Math.min(frame.right - width, left)),
        y: Math.max(frame.top, Math.min(frame.bottom - height, top)),
        width,
        height,
      };
      const routeHit = paths.some((path) => {
        for (let i = 1; i < path.length; i++)
          if (crosses(box, path[i - 1], path[i])) return true;
        return false;
      });
      const pinHit = [origin, destination].some((point) =>
        overlaps(
          box,
          { x: point.x - 8, y: point.y - 8, width: 16, height: 16 },
          0,
        ),
      );
      return {
        box,
        score:
          (routeHit ? 1e6 : 0) +
          (pinHit ? 1e7 : 0) +
          Math.hypot(box.x + width / 2 - x, box.y + height / 2 - y),
      };
    });
  };
  const first = candidates(origin),
    second = candidates(destination);
  let result: [LabelRect, LabelRect] = [first[0].box, second[0].box],
    best = Infinity;
  for (const a of first)
    for (const b of second) {
      const score = a.score + b.score + (overlaps(a.box, b.box) ? 1e9 : 0);
      if (score < best) {
        best = score;
        result = [a.box, b.box];
      }
    }
  return result;
}

export function separateJourneyLabels(
  origin: LabelRect,
  destination: LabelRect,
  right: number,
): [LabelRect, LabelRect] {
  const overlaps =
    origin.x < destination.x + destination.width + 8 &&
    origin.x + origin.width + 8 > destination.x &&
    origin.y < destination.y + destination.height + 8 &&
    origin.y + origin.height + 8 > destination.y;
  if (!overlaps) return [origin, destination];
  // A short map may have room for side-by-side labels but not two stacked labels.
  return origin.x <= destination.x
    ? [
        { ...origin, x: 8 },
        { ...destination, x: right - destination.width },
      ]
    : [
        { ...origin, x: right - origin.width },
        { ...destination, x: 8 },
      ];
}

export const ORBIT: Camera = {
  longitude: 127.5,
  latitude: 36,
  radius: 0.72,
  anchorX: 0.5225,
  anchorY: 0.515,
};

const radians = Math.PI / 180;
const radiusForSpan = (span: number) => 1 / Math.sin((span * radians) / 2);

export function cameraForKorea(
  width: number,
  height: number,
  dpr: number,
): Camera {
  return {
    longitude: 127.7,
    latitude: 36.5,
    radius: radiusForSpan(Math.max(7, (height * dpr * 13.5) / 3072)),
    anchorX: width > 760 ? 0.36 : 0.5,
    anchorY: 0.5,
  };
}

export function cameraForDetail(
  longitude: number,
  latitude: number,
  width: number,
  height: number,
  road: readonly (readonly [number, number])[] = [],
  origin: Pick<
    typeof DEFAULT_TRIP_ORIGIN,
    'longitude' | 'latitude'
  > = DEFAULT_TRIP_ORIGIN,
): Camera {
  const desktop = width > 760;
  const camera: Camera = {
    longitude,
    latitude,
    radius: radiusForSpan(0.36),
    anchorX: desktop ? 0.24 : 0.5,
    anchorY: desktop ? 0.5 : 0.23,
  };
  const originLat = origin.latitude * radians;
  const destinationLat = latitude * radians;
  const deltaLongitude = (longitude - origin.longitude) * radians;
  const x =
    Math.cos(originLat) + Math.cos(destinationLat) * Math.cos(deltaLongitude);
  const y = Math.cos(destinationLat) * Math.sin(deltaLongitude);
  camera.longitude = origin.longitude + Math.atan2(y, x) / radians;
  camera.latitude =
    Math.atan2(
      Math.sin(originLat) + Math.sin(destinationLat),
      Math.hypot(x, y),
    ) / radians;
  const points = [
    [origin.longitude, origin.latitude],
    [longitude, latitude],
    ...road,
  ];
  if (road.length) {
    let west = longitude,
      east = longitude,
      south = latitude,
      north = latitude;
    for (const [lon, lat] of points) {
      west = Math.min(west, lon);
      east = Math.max(east, lon);
      south = Math.min(south, lat);
      north = Math.max(north, lat);
    }
    camera.longitude = (west + east) / 2;
    camera.latitude = (south + north) / 2;
  }
  let extentX = 0,
    extentY = 0;
  for (const [lon, lat] of points) {
    const point = projectLocation(
      { ...camera, radius: 1 },
      lon,
      lat,
      width,
      height,
    );
    extentX = Math.max(extentX, Math.abs(point.x - camera.anchorX * width));
    extentY = Math.max(extentY, Math.abs(point.y - camera.anchorY * height));
  }
  // Leave 20% of the usable map frame for the two labels.
  camera.radius = Math.min(
    camera.radius,
    ((desktop ? 0.21 : 0.44) * width * 0.8) / extentX,
    ((desktop ? 0.33 : 0.11) * height * 0.8) / extentY,
  );
  return camera;
}

export function projectLocation(
  camera: Camera,
  longitude: number,
  latitude: number,
  width: number,
  height: number,
): { x: number; y: number; visible: boolean } {
  const delta = (longitude - camera.longitude) * radians;
  const lat = latitude * radians;
  const cameraLat = camera.latitude * radians;
  const normalX = Math.cos(lat) * Math.sin(delta);
  const normalY =
    Math.cos(cameraLat) * Math.sin(lat) -
    Math.sin(cameraLat) * Math.cos(lat) * Math.cos(delta);
  const normalZ =
    Math.sin(cameraLat) * Math.sin(lat) +
    Math.cos(cameraLat) * Math.cos(lat) * Math.cos(delta);
  const x = camera.anchorX * width + (normalX * camera.radius * height) / 2;
  const y = camera.anchorY * height - (normalY * camera.radius * height) / 2;
  return {
    x,
    y,
    visible: normalZ >= 0 && x >= 0 && x <= width && y >= 0 && y <= height,
  };
}

export function interpolateCamera(
  start: Camera,
  end: Camera,
  progress: number,
): Camera {
  if (progress <= 0) return start;
  if (progress >= 1) return end;
  let longitudeDelta = end.longitude - start.longitude;
  longitudeDelta -= Math.round(longitudeDelta / 360) * 360;
  return {
    longitude: start.longitude + longitudeDelta * progress,
    latitude: start.latitude + (end.latitude - start.latitude) * progress,
    radius: start.radius * Math.pow(end.radius / start.radius, progress),
    anchorX: start.anchorX + (end.anchorX - start.anchorX) * progress,
    anchorY: start.anchorY + (end.anchorY - start.anchorY) * progress,
  };
}
