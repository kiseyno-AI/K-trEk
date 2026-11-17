import type { Activity } from './activities';

export function activityFacts(activity: Activity): [string, string][] {
  const d = activity.details;
  const food = activity.categoryId === 'food';
  const booking = d.booking_notes?.trim().replace(/\s+/g, ' ');
  const reservation = d.group_reservation?.trim().replace(/\s+/g, ' ');
  const facts: [string, string | null][] = [
    ['Location', d.location_type === 'area' ? d.area_description : d.address],
    [
      'Program duration',
      d.operator_duration_minutes === null
        ? null
        : `${d.operator_duration_minutes} minutes`,
    ],
    [
      'Suggested stay',
      food
        ? null
        : d.planned_duration_label ||
          (d.planned_duration_minutes === null
            ? null
            : `${d.planned_duration_minutes} minutes`),
    ],
    ['Duration notes', food ? null : d.duration_notes],
    [
      'Booking status',
      d.booking_status === 'link_checked'
        ? 'Link checked · date not confirmed'
        : d.booking_status === 'date_confirmed'
          ? 'Date confirmed'
          : null,
    ],
    ['Booking', d.booking_notes],
    ['Public contact', d.public_contact],
    [
      'Facility capacity',
      d.facility_capacity === null ? null : `${d.facility_capacity} people`,
    ],
    [
      'Group reservation',
      booking && booking === reservation ? null : d.group_reservation,
    ],
    ['Group discount', d.group_discount],
    ['10 people together', d.group_simultaneous_use],
    [
      'English-speaking staff',
      d.english_staff === 'unknown'
        ? null
        : d.english_staff.replaceAll('_', ' '),
    ],
    [
      'English program',
      d.english_program === 'unknown'
        ? null
        : d.english_program.replaceAll('_', ' '),
    ],
    ['English support notes', d.english_notes],
    [
      'Google rating',
      d.google_data_status === 'verified' && d.google_rating !== null
        ? `${d.google_rating} / 5`
        : null,
    ],
    [
      'Google reviews',
      d.google_data_status === 'verified' && d.google_review_count !== null
        ? String(d.google_review_count)
        : null,
    ],
  ];
  return facts.filter((fact): fact is [string, string] => Boolean(fact[1]));
}
