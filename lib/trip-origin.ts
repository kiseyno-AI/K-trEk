export type TripOrigin = {
  name: string;
  longitude: number;
  latitude: number;
};

export const DEFAULT_TRIP_ORIGIN: TripOrigin = Object.freeze({
  name: 'Seoul Station',
  longitude: 126.9707793,
  latitude: 37.5545547,
});

// Kakao Local station pins; Jonggak is the meeting point in Jongno 1-ga.
export const TRIP_ORIGIN_PRESETS: readonly { id: string; origin: TripOrigin }[] = [
  { id: 'seoul-station', origin: DEFAULT_TRIP_ORIGIN },
  {
    id: 'jongno-1-ga',
    origin: { name: 'Jongno 1-ga', longitude: 126.9831508, latitude: 37.570228 },
  },
  {
    id: 'sinchon-station',
    origin: { name: 'Sinchon Station', longitude: 126.9369808, latitude: 37.5551982 },
  },
  {
    id: 'gangnam-station',
    origin: { name: 'Gangnam Station', longitude: 127.0280014, latitude: 37.4980863 },
  },
  {
    id: 'yangjae-station',
    origin: { name: 'Yangjae Station', longitude: 127.0341641, latitude: 37.4845768 },
  },
];

export function resolveTripOrigin(
  id: string | null,
  configured: TripOrigin,
): TripOrigin {
  if (id === null || id === 'default') return configured;
  const preset = TRIP_ORIGIN_PRESETS.find((entry) => entry.id === id);
  if (!preset) throw new Error('Choose a listed departure.');
  return preset.origin;
}

export function parseTripOrigin(input: unknown): TripOrigin {
  if (!input || typeof input !== 'object' || Array.isArray(input))
    throw new Error('The trip departure must be a named WGS84 location.');
  const value = input as Record<string, unknown>;
  const { name, longitude, latitude } = value;
  if (
    Object.keys(value).some(
      (key) => !['name', 'longitude', 'latitude'].includes(key),
    ) ||
    typeof name !== 'string' ||
    !name.trim() ||
    name.trim().length > 80 ||
    /\p{Cc}/u.test(name) ||
    typeof longitude !== 'number' ||
    !Number.isFinite(longitude) ||
    longitude < -180 ||
    longitude > 180 ||
    typeof latitude !== 'number' ||
    !Number.isFinite(latitude) ||
    latitude < -90 ||
    latitude > 90
  )
    throw new Error(
      'The trip departure needs a name and valid WGS84 coordinates.',
    );
  return { name: name.trim(), longitude, latitude };
}

export function configuredTripOrigin(json: string | undefined): TripOrigin {
  return json === undefined
    ? DEFAULT_TRIP_ORIGIN
    : parseTripOrigin(JSON.parse(json));
}
