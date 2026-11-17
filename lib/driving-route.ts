export type RouteSegment = {
  mode: 'drive' | 'bus' | 'subway' | 'walk';
  path: [number, number][];
};

export type TransitOption = {
  mode: 'bus' | 'subway' | 'bus_and_subway';
  durationSeconds: number;
  distanceMeters: number;
  fareKrw: number | null;
  transfers: number | null;
  segments: RouteSegment[];
};

export type TransitStatus =
  | 'ok'
  | 'unavailable'
  | 'no_route'
  | 'rate_limited'
  | 'upstream_error';

export type DrivingRoute = {
  status: 'ok';
  activityId: string;
  origin: TripOrigin;
  path: [number, number][];
  durationSeconds: number;
  distanceMeters: number;
  taxiFareKrw: number | null;
  tollFareKrw: number | null;
  transitOptions: TransitOption[];
  transitStatus: TransitStatus;
  transitMessage: string | null;
  fetchedAt: string;
  provider: 'kakao';
};

export type DrivingRouteErrorStatus =
  | 'missing_key'
  | 'no_route'
  | 'rate_limited'
  | 'upstream_error'
  | 'invalid_destination';

export type DrivingRouteResponse =
  | DrivingRoute
  | { status: DrivingRouteErrorStatus; message: string };
import type { TripOrigin } from './trip-origin';
