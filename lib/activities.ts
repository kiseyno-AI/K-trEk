export const CATEGORIES = {
  culture: 'Culture & Art',
  history: 'History & Heritage',
  food: 'Food',
  nature: 'Nature',
  nightlife: 'Nightlife',
  shopping: 'Shopping',
  wellness: 'Skin & Beauty',
  experience: 'Activities',
} as const;
export const REGIONS = {
  seoul: 'Seoul',
  busan: 'Busan',
  incheon: 'Incheon',
  daegu: 'Daegu',
  daejeon: 'Daejeon',
  gwangju: 'Gwangju',
  ulsan: 'Ulsan',
  sejong: 'Sejong',
  gyeonggi: 'Gyeonggi',
  gangwon: 'Gangwon',
  chungbuk: 'Chungbuk',
  chungnam: 'Chungnam',
  jeonbuk: 'Jeonbuk',
  jeonnam: 'Jeonnam',
  gyeongbuk: 'Gyeongbuk',
  gyeongnam: 'Gyeongnam',
  jeju: 'Jeju',
} as const;

export const IMAGE_RIGHTS_LABELS = {
  unverified: 'Reuse rights unverified',
  licensed: 'Licensed image',
  owned: 'Owned image',
  official_reference: 'Official website reference · reuse license unverified',
} as const;

export const emptyActivity = {
  id: '',
  name_ko: '',
  name_en: '',
  category_id: 'culture',
  region_id: 'seoul',
  region_name: null as string | null,
  card_location: null as string | null,
  location_type: 'point',
  address: null as string | null,
  area_description: null as string | null,
  summary_en: null as string | null,
  activity_en: null as string | null,
  planned_duration_minutes: null as number | null,
  planned_duration_label: null as string | null,
  operator_duration_minutes: null as number | null,
  duration_notes: null as string | null,
  booking_url: null as string | null,
  public_contact: null as string | null,
  booking_status: 'unknown',
  booking_notes: null as string | null,
  facility_capacity: null as number | null,
  group_reservation: null as string | null,
  group_discount: null as string | null,
  group_simultaneous_use: null as string | null,
  english_website_url: null as string | null,
  english_staff: 'unknown',
  english_program: 'unknown',
  english_notes: null as string | null,
  image_reference_urls: [] as string[],
  image_url: null as string | null,
  image_caption: null as string | null,
  image_attribution: null as string | null,
  image_rights: 'unverified',
  preview_image_url: null as string | null,
  youtube_video_urls: [] as string[],
  youtube_search_url: null as string | null,
  youtube_channel_url: null as string | null,
  google_maps_url: null as string | null,
  google_rating: null as number | null,
  google_review_count: null as number | null,
  google_place_id: null as string | null,
  google_data_status: 'unverified',
  driving_minutes: null as number | null,
  latitude: null as number | null,
  longitude: null as number | null,
  coordinate_status: 'unassigned',
  map_latitude: null as number | null,
  map_longitude: null as number | null,
  map_coordinate_status: 'unassigned',
  shawn_comment: null as string | null,
  sun_comment: null as string | null,
  shawn_rating: null as number | null,
  sun_rating: null as number | null,
  source_urls: [] as string[],
  source_evidence: null as string | null,
  checked_at: null as string | null,
  is_illustrative: false,
  published: true,
};
export type ActivityInput = typeof emptyActivity;
export type ActivityRecord = ActivityInput & {
  created_at: string;
  updated_at: string;
};
export type Activity = {
  id: string;
  title: string;
  korean: string;
  region: string;
  cardLocation: string;
  category: string;
  categoryId: string;
  regionId: string;
  summary: string;
  description: string;
  duration: string;
  travelMinutes: number | null;
  image: string | null;
  quote: string | null;
  host: string | null;
  mapFocus: [number, number] | null;
  mapIsIllustrative: boolean;
  details: ActivityInput;
};

type Field = {
  key: keyof ActivityInput;
  label: string;
  kind?:
    | 'textarea'
    | 'number'
    | 'rating'
    | 'url'
    | 'urls'
    | 'date'
    | 'checkbox';
  options?: readonly string[];
  hint?: string;
};
export const ACTIVITY_FIELD_GROUPS: { title: string; fields: Field[] }[] = [
  {
    title: 'Names and location',
    fields: [
      {
        key: 'id',
        label: 'Card ID',
        hint: 'Lowercase letters, numbers and hyphens. Keep this stable.',
      },
      { key: 'name_ko', label: 'Korean name' },
      { key: 'name_en', label: 'English name' },
      {
        key: 'category_id',
        label: 'Category ID',
        options: Object.keys(CATEGORIES),
      },
      { key: 'region_id', label: 'Region ID', options: Object.keys(REGIONS) },
      { key: 'region_name', label: 'City / region display name' },
      {
        key: 'card_location',
        label: 'Card location',
        hint: 'City and district only, for example Seoul · Gangnam-gu. Neighborhoods and full addresses belong in the detail fields.',
      },
      {
        key: 'location_type',
        label: 'Location type',
        options: ['point', 'area'],
      },
      { key: 'address', label: 'Address' },
      {
        key: 'area_description',
        label: 'Area / route boundary',
        kind: 'textarea',
      },
      { key: 'summary_en', label: 'English card summary', kind: 'textarea' },
      {
        key: 'activity_en',
        label: 'English activity description',
        kind: 'textarea',
      },
    ],
  },
  {
    title: 'Duration and booking',
    fields: [
      {
        key: 'planned_duration_minutes',
        label: 'Suggested stay (minutes)',
        kind: 'number',
      },
      {
        key: 'planned_duration_label',
        label: 'Suggested stay label',
        hint: 'For example: 1 night. This is a planning suggestion.',
      },
      {
        key: 'operator_duration_minutes',
        label: 'Operator program duration (minutes)',
        kind: 'number',
      },
      {
        key: 'duration_notes',
        label: 'Duration evidence / notes',
        kind: 'textarea',
      },
      { key: 'booking_url', label: 'Booking link', kind: 'url' },
      { key: 'public_contact', label: 'Public contact' },
      {
        key: 'booking_status',
        label: 'Booking status',
        options: ['unknown', 'link_checked', 'date_confirmed'],
      },
      {
        key: 'booking_notes',
        label: 'Booking date / confirmation notes',
        kind: 'textarea',
      },
    ],
  },
  {
    title: 'Conditions for 10 people',
    fields: [
      {
        key: 'facility_capacity',
        label: 'Published facility capacity',
        kind: 'number',
      },
      {
        key: 'group_reservation',
        label: 'Group reservation conditions',
        kind: 'textarea',
      },
      {
        key: 'group_discount',
        label: 'Group discount conditions',
        kind: 'textarea',
      },
      {
        key: 'group_simultaneous_use',
        label: 'Can 10 people participate together?',
        kind: 'textarea',
      },
    ],
  },
  {
    title: 'English support',
    fields: [
      { key: 'english_website_url', label: 'English website', kind: 'url' },
      {
        key: 'english_staff',
        label: 'English-speaking staff',
        options: ['unknown', 'available', 'unavailable', 'on_request'],
      },
      {
        key: 'english_program',
        label: 'English program',
        options: ['unknown', 'available', 'unavailable', 'on_request'],
      },
      {
        key: 'english_notes',
        label: 'English support evidence / notes',
        kind: 'textarea',
      },
    ],
  },
  {
    title: 'Photos and video',
    fields: [
      {
        key: 'image_reference_urls',
        label: 'Photo reference pages',
        kind: 'urls',
        hint: 'One URL per line. References do not grant reuse rights.',
      },
      {
        key: 'image_url',
        label: 'Display image URL',
        kind: 'url',
        hint: 'Public http(s) URL or a registered /trip/photos/ image.',
      },
      {
        key: 'image_caption',
        label: 'Photo context / caption',
        kind: 'textarea',
      },
      {
        key: 'image_attribution',
        label: 'Photo credit and rights status',
        kind: 'textarea',
      },
      {
        key: 'image_rights',
        label: 'Image reuse rights',
        options: Object.keys(IMAGE_RIGHTS_LABELS),
        hint: 'Official website reference means the reuse license is unverified; it does not claim a license.',
      },
      {
        key: 'youtube_video_urls',
        label: 'Actual related YouTube videos',
        kind: 'urls',
      },
      { key: 'youtube_search_url', label: 'YouTube search link', kind: 'url' },
      {
        key: 'youtube_channel_url',
        label: 'Official YouTube channel',
        kind: 'url',
      },
    ],
  },
  {
    title: 'Maps and coordinates',
    fields: [
      {
        key: 'google_maps_url',
        label: 'Google Maps search / place link',
        kind: 'url',
      },
      { key: 'google_rating', label: 'Google rating', kind: 'number' },
      {
        key: 'google_review_count',
        label: 'Google review count',
        kind: 'number',
      },
      { key: 'google_place_id', label: 'Google Place ID' },
      {
        key: 'google_data_status',
        label: 'Google data status',
        options: ['unverified', 'verified'],
      },
      {
        key: 'driving_minutes',
        label: 'Verified driving time (minutes)',
        kind: 'number',
        hint: 'Leave blank until the travel-date route is checked.',
      },
      { key: 'latitude', label: 'Actual latitude', kind: 'number' },
      { key: 'longitude', label: 'Actual longitude', kind: 'number' },
      {
        key: 'coordinate_status',
        label: 'Actual coordinate status',
        options: ['unassigned', 'unverified', 'verified'],
      },
      { key: 'map_latitude', label: 'Code-map latitude', kind: 'number' },
      { key: 'map_longitude', label: 'Code-map longitude', kind: 'number' },
      {
        key: 'map_coordinate_status',
        label: 'Code-map coordinate status',
        options: ['unassigned', 'illustrative', 'verified'],
      },
    ],
  },
  {
    title: 'Shawn and Sun reviews',
    fields: [
      { key: 'shawn_rating', label: "Shawn's rating", kind: 'rating' },
      {
        key: 'shawn_comment',
        label: "Shawn's comment",
        kind: 'textarea',
        hint: 'Write two or three sentences. Leave blank until Shawn adds a comment.',
      },
      { key: 'sun_rating', label: "Sun's rating", kind: 'rating' },
      {
        key: 'sun_comment',
        label: "Sun's comment",
        kind: 'textarea',
        hint: 'Write two or three sentences. Leave blank until Sun adds a comment.',
      },
    ],
  },
  {
    title: 'Evidence and publication',
    fields: [
      { key: 'source_urls', label: 'Source pages', kind: 'urls' },
      {
        key: 'source_evidence',
        label: 'Verification evidence / remaining gaps',
        kind: 'textarea',
      },
      { key: 'checked_at', label: 'Checked date', kind: 'date' },
      {
        key: 'published',
        label: 'Show this card on the trip page',
        kind: 'checkbox',
      },
      {
        key: 'is_illustrative',
        label: 'Illustrative sample record',
        kind: 'checkbox',
      },
      {
        key: 'preview_image_url',
        label: 'Sample-only preview image URL',
        kind: 'url',
        hint: 'Used only by illustrative samples; this does not claim image rights.',
      },
    ],
  },
];
export const ACTIVITY_FIELDS = ACTIVITY_FIELD_GROUPS.flatMap(
  (group) => group.fields,
);
export const ACTIVITY_COLUMNS = ACTIVITY_FIELDS.map((field) => field.key);
export const URL_LIST_FIELDS = [
  'image_reference_urls',
  'youtube_video_urls',
  'source_urls',
] as const;
export const BOOLEAN_FIELDS = ['is_illustrative', 'published'] as const;

export function parseActivity(value: unknown): ActivityInput {
  if (!value || typeof value !== 'object' || Array.isArray(value))
    throw new Error('Expected an activity object.');
  const source = value as Record<string, unknown>;
  for (const key of Object.keys(source))
    if (!ACTIVITY_COLUMNS.includes(key as keyof ActivityInput))
      throw new Error('Unknown field: ' + key);
  const record = { ...emptyActivity } as ActivityInput;
  const output = record as Record<string, unknown>;
  const validUrl = (text: string) => {
    let url: URL;
    try {
      url = new URL(text);
    } catch {
      throw new Error('Use a complete http(s) URL.');
    }
    if (
      !['https:', 'http:'].includes(url.protocol) ||
      url.username ||
      url.password
    )
      throw new Error('Only public http(s) URLs are allowed.');
    return text;
  };
  for (const field of ACTIVITY_FIELDS) {
    const input = source[field.key];
    if (input === undefined) continue;
    if (field.kind === 'checkbox') {
      if (typeof input !== 'boolean')
        throw new Error(field.label + ' must be true or false.');
      output[field.key] = input;
    } else if (field.kind === 'urls') {
      if (
        !Array.isArray(input) ||
        input.length > 30 ||
        input.some((v) => typeof v !== 'string' || v.length > 2048)
      )
        throw new Error(field.label + ' must be a list of up to 30 URLs.');
      output[field.key] = [
        ...new Set(input.map((v) => validUrl(v.trim())).filter(Boolean)),
      ];
    } else if (field.kind === 'number' || field.kind === 'rating') {
      if (input === null || input === '') {
        output[field.key] = null;
        continue;
      }
      if (typeof input !== 'number' || !Number.isFinite(input))
        throw new Error(field.label + ' must be a finite number or blank.');
      const decimal = [
        'latitude',
        'longitude',
        'map_latitude',
        'map_longitude',
        'google_rating',
      ].includes(field.key);
      const minimum =
        field.kind === 'rating'
          ? 1
          : field.key.includes('latitude')
            ? -90
            : field.key.includes('longitude')
              ? -180
              : 0;
      const maximum =
        field.kind === 'rating'
          ? 5
          : field.key.includes('latitude')
            ? 90
            : field.key.includes('longitude')
              ? 180
              : field.key === 'google_rating'
                ? 5
                : field.key.includes('duration') ||
                    field.key === 'driving_minutes'
                  ? 10080
                  : 100000000;
      if (
        input < minimum ||
        input > maximum ||
        (!decimal && !Number.isInteger(input))
      )
        throw new Error(field.label + ' is outside the allowed range.');
      output[field.key] = input;
    } else {
      if (input === null && emptyActivity[field.key] === null) {
        output[field.key] = null;
        continue;
      }
      if (
        typeof input !== 'string' ||
        input.length > (field.kind === 'textarea' ? 10000 : 2048)
      )
        throw new Error(field.label + ' is too long or invalid.');
      const text = input.trim();
      if (field.options && !field.options.includes(text))
        throw new Error('Unknown ' + field.label + '.');
      output[field.key] =
        text || (emptyActivity[field.key] === null ? null : '');
      if (field.kind === 'url' && text) {
        const localPhoto =
          field.key === 'image_url' &&
          /^\/trip\/photos\/[a-z0-9-]+\.(webp|jpg|png)$/.test(text);
        if (!localPhoto) validUrl(text);
      }
    }
  }
  if (!/^[a-z0-9][a-z0-9-]{0,79}$/.test(record.id))
    throw new Error('Card ID must use lowercase letters, numbers and hyphens.');
  if (
    !record.name_ko ||
    !record.name_en ||
    record.name_ko.length > 300 ||
    record.name_en.length > 300
  )
    throw new Error('Both names are required (up to 300 characters).');
  if (
    record.checked_at &&
    (!/^\d{4}-\d{2}-\d{2}$/.test(record.checked_at) ||
      new Date(record.checked_at).toISOString().slice(0, 10) !==
        record.checked_at)
  )
    throw new Error('Checked date must be a valid YYYY-MM-DD date.');
  for (const [latitude, longitude, status] of [
    ['latitude', 'longitude', 'coordinate_status'],
    ['map_latitude', 'map_longitude', 'map_coordinate_status'],
  ] as const) {
    if ((record[latitude] === null) !== (record[longitude] === null))
      throw new Error(
        'Supply both latitude and longitude, or leave both blank.',
      );
    if (record[status] !== 'unassigned' && record[latitude] === null)
      throw new Error('Coordinate status requires a coordinate pair.');
    if (record[status] === 'unassigned' && record[latitude] !== null)
      throw new Error('Set the coordinate status for the supplied pair.');
  }
  if (record.image_url && record.image_rights === 'unverified')
    throw new Error(
      'Confirm image reuse rights before setting the displayed image URL.',
    );
  if (record.image_rights === 'official_reference') {
    const localPhoto =
      record.image_url &&
      /^\/trip\/photos\/[a-z0-9-]+\.(webp|jpg|png)$/.test(record.image_url);
    if (
      !record.image_url ||
      (!localPhoto && new URL(record.image_url).protocol !== 'https:')
    )
      throw new Error(
        'Official photo references require a controlled local image or an HTTPS image URL.',
      );
    if (
      !record.image_reference_urls.some(
        (url) => new URL(url).protocol === 'https:',
      )
    )
      throw new Error(
        'Official photo references require an HTTPS source page; reuse rights remain unverified.',
      );
  }
  if (record.preview_image_url && !record.is_illustrative)
    throw new Error(
      'Sample preview images require an illustrative sample record.',
    );
  for (const link of record.youtube_video_urls) {
    const url = new URL(link);
    const youtube = [
      'youtube.com',
      'www.youtube.com',
      'm.youtube.com',
    ].includes(url.hostname);
    const videoId =
      url.hostname === 'youtu.be'
        ? url.pathname.match(/^\/([A-Za-z0-9_-]{11})\/?$/)?.[1]
        : youtube
          ? /^\/watch\/?$/.test(url.pathname)
            ? url.searchParams.get('v')
            : url.pathname.match(
                /^\/(?:shorts|embed)\/([A-Za-z0-9_-]{11})\/?$/,
              )?.[1]
          : null;
    const channelEmbed =
      url.pathname.startsWith('/embed/') &&
      ['videoseries', 'live_stream'].includes(videoId || '');
    if (
      url.port ||
      !videoId ||
      channelEmbed ||
      !/^[A-Za-z0-9_-]{11}$/.test(videoId)
    )
      throw new Error(
        'Actual YouTube videos must use a watch, shorts, embed or youtu.be video URL. Put search and channel links in their separate fields.',
      );
  }
  if (record.location_type === 'area' && !record.area_description)
    throw new Error('Describe the boundary of an area or route.');
  return record;
}

export function toActivity(record: ActivityInput): Activity {
  const trueCoordinates =
    record.coordinate_status === 'verified' &&
    record.longitude !== null &&
    record.latitude !== null;
  const mapCoordinates =
    record.map_coordinate_status !== 'unassigned' &&
    record.map_longitude !== null &&
    record.map_latitude !== null;
  const minutes =
    record.operator_duration_minutes ?? record.planned_duration_minutes;
  const duration =
    record.operator_duration_minutes === null && record.planned_duration_label
      ? record.planned_duration_label
      : minutes === null
        ? 'Duration to be confirmed'
        : minutes < 60
          ? `${minutes} min`
          : `${Math.round(minutes / 6) / 10} hours`;
  return {
    id: record.id,
    title: record.name_en,
    korean: record.name_ko,
    region:
      record.region_name || REGIONS[record.region_id as keyof typeof REGIONS],
    cardLocation:
      record.card_location || REGIONS[record.region_id as keyof typeof REGIONS],
    category: CATEGORIES[record.category_id as keyof typeof CATEGORIES],
    categoryId: record.category_id,
    regionId: record.region_id,
    summary: record.summary_en || '',
    description: record.activity_en || '',
    duration,
    travelMinutes: record.driving_minutes,
    image:
      record.image_url ||
      (record.is_illustrative ? record.preview_image_url : null),
    quote: record.shawn_comment || record.sun_comment,
    host: record.shawn_comment ? 'Shawn' : record.sun_comment ? 'Sun' : null,
    mapFocus: trueCoordinates
      ? [record.longitude!, record.latitude!]
      : mapCoordinates
        ? [record.map_longitude!, record.map_latitude!]
        : null,
    mapIsIllustrative:
      !trueCoordinates &&
      mapCoordinates &&
      record.map_coordinate_status === 'illustrative',
    details: record,
  };
}
