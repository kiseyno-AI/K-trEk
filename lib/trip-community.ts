import { createHash, randomUUID } from 'node:crypto';
import { CATEGORIES, parseActivity } from './activities.ts';
import { readAdminJson } from './admin-access.ts';
import { MAX_VOTES, remainingTime } from './vote-planning.ts';
import {
  normalizeTripName,
  tripRequestOrigin,
  type TripUser,
} from './trip-auth.ts';

export type TripPreferences = {
  categoryIds: string[];
  draftVoteIds: string[];
  submittedVoteIds: string[];
  updatedAt: number | null;
};
export type TripPreferenceInput = Omit<TripPreferences, 'updatedAt'> & {
  submitVote?: boolean;
};
export type TripReport = {
  id: string;
  userId: string;
  memberName: string;
  message: string;
  createdAt: number;
  readAt: number | null;
};
export type TripMember = TripUser & {
  createdAt: number;
  categoryIds: string[];
  draftVoteIds: string[];
  submittedVoteIds: string[];
  favoriteIds: string[];
};
export type TripVoter = Pick<TripMember, 'id' | 'name' | 'submittedVoteIds'>;
export type HostReviews = {
  shawn_comment: string | null;
  sun_comment: string | null;
  shawn_rating: number | null;
  sun_rating: number | null;
};
export type TripCommunityStore = {
  publishedIds(): Promise<string[]>;
  preferences(userId: string): Promise<TripPreferences>;
  savePreferences(
    userId: string,
    input: TripPreferenceInput,
    now: number,
  ): Promise<void>;
  members(): Promise<TripMember[]>;
  reports(): Promise<TripReport[]>;
  createReport(
    id: string,
    userId: string,
    message: string,
    now: number,
  ): Promise<TripReport>;
  markReportsRead(ids: string[], now: number): Promise<void>;
  updateReviews(id: string, reviews: HostReviews): Promise<HostReviews | null>;
  consumeLimit(
    keyHash: string,
    now: number,
    expiresAt: number,
  ): Promise<number>;
};
class CommunityError extends Error {
  readonly status: number;
  constructor(message: string, status = 400) {
    super(message);
    this.status = status;
  }
}
const activityId = (value: unknown): value is string =>
  typeof value === 'string' && /^[a-z0-9][a-z0-9-]{0,99}$/u.test(value);
function onlyKeys(value: Record<string, unknown>, keys: string[]) {
  if (
    Object.keys(value).length !== keys.length ||
    Object.keys(value).some((key) => !keys.includes(key))
  )
    throw new CommunityError('Send only the required fields.');
}
function stringList(
  value: unknown,
  max: number,
  label: string,
  valid: (id: unknown) => boolean,
): string[] {
  if (
    !Array.isArray(value) ||
    value.length > max ||
    value.some((id) => !valid(id)) ||
    new Set(value).size !== value.length
  )
    throw new CommunityError(
      `${label} must contain up to ${max} distinct valid IDs.`,
    );
  return value as string[];
}
async function body(request: Request) {
  if (request.headers.get('origin') !== tripRequestOrigin(request))
    throw new CommunityError('Use the trip website to make this request.', 403);
  let input: unknown;
  try {
    input = await readAdminJson(request);
  } catch (error) {
    throw new CommunityError(
      error instanceof Error ? error.message : 'Send valid JSON.',
    );
  }
  if (!input || typeof input !== 'object' || Array.isArray(input))
    throw new CommunityError('Send a JSON object.');
  return input as Record<string, unknown>;
}

export function createTripCommunityHandlers(
  store: TripCommunityStore,
  options: {
    authenticate: (request: Request) => Promise<TripUser | null>;
    now?: () => number;
  },
) {
  const now = options.now ?? Date.now;
  const reply = (input: unknown, status = 200) =>
    Response.json(input, {
      status,
      headers: {
        'Cache-Control': 'no-store',
        Vary: 'Cookie',
        'X-Content-Type-Options': 'nosniff',
      },
    });
  const guarded =
    (handle: (request: Request, id?: string) => Promise<Response>) =>
    async (request: Request, id?: string) => {
      try {
        return await handle(request, id);
      } catch (error) {
        return reply(
          {
            error:
              error instanceof CommunityError
                ? error.message
                : 'This request is temporarily unavailable.',
          },
          error instanceof CommunityError ? error.status : 503,
        );
      }
    };
  const member = async (request: Request, permission?: 'shawn' | 'hosts') => {
    const user = await options.authenticate(request);
    if (!user) throw new CommunityError('Sign in to use this feature.', 401);
    const key = normalizeTripName(user.name).nameKey;
    if (
      permission &&
      (user.role !== 'admin' ||
        (permission === 'shawn'
          ? key !== 'shawn'
          : !['shawn', 'sun'].includes(key)))
    )
      throw new CommunityError(
        permission === 'shawn'
          ? 'Only Shawn can view this information.'
          : 'Administrator access is required.',
        403,
      );
    return user;
  };
  const limit = async (key: string, count: number, windowMs: number) => {
    const time = now();
    if (
      (await store.consumeLimit(
        createHash('sha256').update(`community:${key}`).digest('hex'),
        time,
        time + windowMs,
      )) > count
    )
      throw new CommunityError(
        'Too many requests. Please try again later.',
        429,
      );
  };
  return {
    reviews: guarded(async (request, id) => {
      if (request.method !== 'PATCH')
        return reply({ error: 'Method not allowed.' }, 405);
      const user = await member(request, 'hosts');
      const input = await body(request);
      onlyKeys(input, [
        'shawn_comment',
        'sun_comment',
        'shawn_rating',
        'sun_rating',
      ]);
      if (!activityId(id))
        throw new CommunityError('This activity was not found.', 404);
      for (const field of ['shawn_comment', 'sun_comment'])
        if (
          input[field] !== null &&
          (typeof input[field] !== 'string' || input[field].length > 10000)
        )
          throw new CommunityError(
            'Comments must be text of up to 10,000 characters, or null.',
          );
      for (const field of ['shawn_rating', 'sun_rating'])
        if (
          input[field] !== null &&
          (typeof input[field] !== 'number' ||
            !Number.isInteger(input[field]) ||
            input[field] < 1 ||
            input[field] > 5)
        )
          throw new CommunityError(
            'Ratings must be an integer from 1 to 5, or null.',
          );
      let parsed;
      try {
        parsed = parseActivity({
          id,
          name_ko: 'Review',
          name_en: 'Review',
          ...input,
        });
      } catch {
        throw new CommunityError('The host reviews are invalid.');
      }
      const reviews = {
        shawn_comment: parsed.shawn_comment,
        sun_comment: parsed.sun_comment,
        shawn_rating: parsed.shawn_rating,
        sun_rating: parsed.sun_rating,
      };
      await limit(`reviews:${user.id}`, 60, 60000);
      const saved = await store.updateReviews(id, reviews);
      if (!saved) throw new CommunityError('This activity was not found.', 404);
      return reply({ reviews: saved });
    }),
    members: guarded(async (request) => {
      if (request.method !== 'GET')
        return reply({ error: 'Method not allowed.' }, 405);
      const votesOnly = new URL(request.url).searchParams.get('view') === 'votes';
      await member(request, votesOnly ? 'hosts' : 'shawn');
      const members = await store.members();
      if (votesOnly) {
        const votes: TripVoter[] = members
          .filter((entry) => entry.submittedVoteIds.length > 0)
          .map(({ id, name, submittedVoteIds }) => ({ id, name, submittedVoteIds }));
        return reply({ votes });
      }
      return reply({ members });
    }),
    preferences: guarded(async (request) => {
      if (!['GET', 'PUT'].includes(request.method))
        return reply({ error: 'Method not allowed.' }, 405);
      const user = await member(request);
      if (request.method === 'PUT') {
        const input = await body(request);
        onlyKeys(input, [
          'categoryIds', 'draftVoteIds', 'submittedVoteIds',
          ...(Object.hasOwn(input, 'submitVote') ? ['submitVote'] : []),
        ]);
        if (Object.hasOwn(input, 'submitVote') && typeof input.submitVote !== 'boolean')
          throw new CommunityError('Choose whether to confirm your vote.');
        const submitVote = input.submitVote === true;
        const categories = stringList(
          input.categoryIds,
          Object.keys(CATEGORIES).length,
          'Categories',
          (id) => typeof id === 'string' && Object.hasOwn(CATEGORIES, id),
        );
        const draft = stringList(
          input.draftVoteIds,
          MAX_VOTES,
          'Draft votes',
          activityId,
        );
        const submitted = stringList(
          input.submittedVoteIds,
          MAX_VOTES,
          'Submitted votes',
          activityId,
        );
        if (submitVote && submitted.length === 0)
          throw new CommunityError('Confirm at least one activity.');
        const published = new Set(await store.publishedIds());
        if ([...draft, ...(submitVote ? submitted : [])].some((id) => !published.has(id)))
          throw new CommunityError('Choose only published activities.');
        await limit(`preferences:${user.id}`, 120, 60000);
        const savedAt = now();
        if (submitVote && remainingTime(savedAt).expired)
          throw new CommunityError('Voting has closed.', 409);
        await store.savePreferences(
          user.id,
          {
            categoryIds: categories,
            draftVoteIds: draft,
            submittedVoteIds: submitted,
            submitVote,
          },
          savedAt,
        );
      }
      return reply({ preferences: await store.preferences(user.id) });
    }),
    reports: guarded(async (request) => {
      if (!['GET', 'POST', 'PATCH'].includes(request.method))
        return reply({ error: 'Method not allowed.' }, 405);
      const user = await member(
        request,
        request.method === 'POST' ? undefined : 'shawn',
      );
      if (request.method === 'POST') {
        const input = await body(request);
        onlyKeys(input, ['message']);
        if (
          typeof input.message !== 'string' ||
          input.message.trim().length < 1 ||
          input.message.trim().length > 2000
        )
          throw new CommunityError(
            'Write a report between 1 and 2,000 characters.',
          );
        await limit(`reports:${user.id}`, 10, 15 * 60000);
        return reply(
          {
            report: await store.createReport(
              randomUUID(),
              user.id,
              input.message.trim(),
              now(),
            ),
          },
          201,
        );
      }
      if (request.method === 'PATCH') {
        const input = await body(request);
        onlyKeys(input, ['reportIds']);
        const ids = stringList(
          input.reportIds,
          100,
          'Reports',
          (id) => typeof id === 'string' && /^[a-f0-9-]{36}$/u.test(id),
        );
        await limit(`report-read:${user.id}`, 120, 60000);
        await store.markReportsRead(ids, now());
      }
      return reply({ reports: await store.reports() });
    }),
  };
}
