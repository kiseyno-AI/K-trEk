import type { ActivityInput } from './activities';

export const activitySeeds: Partial<ActivityInput>[] = [
  {
    id: 'temple',
    name_ko: '템플스테이',
    name_en: 'Mountain temple stay',
    category_id: 'culture',
    region_id: 'gyeongbuk',
    region_name: 'Gyeongju',
    location_type: 'area',
    area_description:
      'Illustrative Gyeongju-area temple experience. A specific operator and address have not been selected.',
    summary_en: 'A quiet night of lanterns, tea and dawn bells.',
    activity_en:
      'Slow down inside a mountain temple, share a simple dinner, and wake before sunrise for the first bell.',
    planned_duration_label: '1 night',
    duration_notes:
      'Prototype planning suggestion; no operator program duration has been verified.',
    preview_image_url:
      'https://images.unsplash.com/photo-1548115184-bc6544d06a58?auto=format&fit=crop&w=1200&q=86',
    map_longitude: 129.22,
    map_latitude: 35.86,
    map_coordinate_status: 'illustrative',
    source_evidence:
      'Illustrative sample transferred from the existing prototype. No booking, group-size, language, route, venue or image-rights claims have been verified.',
    is_illustrative: true,
  },
  {
    id: 'seoul',
    name_ko: '서울 시장 한 상',
    name_en: 'Seoul market table',
    category_id: 'food',
    region_id: 'seoul',
    region_name: 'Seoul',
    location_type: 'area',
    area_description:
      'Illustrative Seoul market area. A specific venue and address have not been selected.',
    summary_en: 'Cook, taste and trade stories in an old market.',
    activity_en:
      'Shop with a local cook, build a shared table, and learn the rituals behind everyday Korean food.',
    planned_duration_minutes: 180,
    duration_notes:
      'Prototype planning suggestion; no operator program duration has been verified.',
    preview_image_url:
      'https://images.unsplash.com/photo-1498654896293-37aacf113fd9?auto=format&fit=crop&w=1200&q=86',
    map_longitude: 126.98,
    map_latitude: 37.57,
    map_coordinate_status: 'illustrative',
    source_evidence:
      'Illustrative sample transferred from the existing prototype. No booking, group-size, language, route, venue or image-rights claims have been verified.',
    is_illustrative: true,
  },
  {
    id: 'busan',
    name_ko: '부산 야경 산책',
    name_en: 'Busan after dark',
    category_id: 'nightlife',
    region_id: 'busan',
    region_name: 'Busan',
    location_type: 'area',
    area_description:
      'Illustrative Busan harbor and seaside walk. Exact route boundaries have not been selected.',
    summary_en: 'Sea air, hillside lights and late-night street food.',
    activity_en:
      'Start above the harbor, drift through the lit alleys, then finish with hotteok by the beach.',
    planned_duration_minutes: 240,
    duration_notes:
      'Prototype planning suggestion; no operator program duration has been verified.',
    map_longitude: 129.08,
    map_latitude: 35.18,
    map_coordinate_status: 'illustrative',
    source_evidence:
      'Illustrative sample transferred from the existing prototype. No booking, group-size, language, route, venue or image-rights claims have been verified.',
    is_illustrative: true,
  },
];
