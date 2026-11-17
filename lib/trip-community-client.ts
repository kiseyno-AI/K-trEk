import { sitePath } from './site-path.ts';
import { CATEGORIES } from './activities.ts';
import { MAX_VOTES } from './vote-planning.ts';

export type MemberPreferences = {
  categoryIds: string[];
  draftVoteIds: string[];
  submittedVoteIds: string[];
};
export type StoredMemberPreferences = MemberPreferences & {
  updatedAt: number | null;
};
export type TripReport = {
  id: string;
  userId: string;
  memberName: string;
  message: string;
  createdAt: number;
  readAt: number | null;
};
export type TripMember = MemberPreferences & {
  id: string;
  name: string;
  role: 'member' | 'admin';
  createdAt: number;
  favoriteIds: string[];
};

export type TripVoter = Pick<TripMember, 'id' | 'name' | 'submittedVoteIds'>;

export class CommunityRequestError extends Error {
  readonly status: number;
  constructor(message: string, status = 0) {
    super(message);
    this.status = status;
  }
}

export async function communityRequest<T>(
  path: string,
  signal: AbortSignal,
  options: { method?: string; body?: unknown } = {},
): Promise<T> {
  if (signal.aborted) throw signal.reason;
  const request = new AbortController();
  const abort = () => request.abort();
  signal.addEventListener('abort', abort, { once: true });
  const timeout = setTimeout(abort, 8000);
  try {
    const response = await fetch(sitePath(path), {
      signal: request.signal,
      cache: 'no-store',
      method: options.method ?? 'GET',
      ...(options.body === undefined
        ? {}
        : {
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(options.body),
          }),
    });
    const result = (await response.json()) as T & { error?: string };
    if (!response.ok)
      throw new CommunityRequestError(
        result?.error ||
          'This request could not be completed. Please try again.',
        response.status,
      );
    return result;
  } catch (error) {
    if (!signal.aborted && request.signal.aborted)
      throw new CommunityRequestError(
        'The request timed out. Please try again.',
      );
    throw error;
  } finally {
    clearTimeout(timeout);
    signal.removeEventListener('abort', abort);
  }
}

export function createMemberPreferenceSync(options: {
  initialVotes: Pick<MemberPreferences, 'draftVoteIds' | 'submittedVoteIds'>;
  onRestore: (
    votes: Pick<MemberPreferences, 'draftVoteIds' | 'submittedVoteIds'>,
  ) => void;
  onError: (message: string) => void;
  onSessionExpired?: () => void;
}) {
  const controller = new AbortController();
  let disposed = false;
  let ready = false;
  let reading = false;
  let writing = false;
  let currentRead: Promise<void> | null = null;
  let currentWrite: Promise<void> | null = null;
  let currentVote: Promise<string[]> | null = null;
  let votesChanged = false;
  let saved = '';
  let timer: ReturnType<typeof setTimeout> | undefined;
  const unique = (values: string[]) => [...new Set(values)];
  let choices: MemberPreferences = {
    categoryIds: [],
    draftVoteIds: unique(options.initialVotes.draftVoteIds).slice(0, MAX_VOTES),
    submittedVoteIds: unique(options.initialVotes.submittedVoteIds).slice(
      0,
      MAX_VOTES,
    ),
  };
  const key = (value: MemberPreferences) => JSON.stringify(value);
  const failure = (error: unknown) => {
    if (disposed) return;
    if (error instanceof CommunityRequestError && error.status === 401)
      options.onSessionExpired?.();
    options.onError(
      error instanceof Error ? error.message : 'Choices could not sync.',
    );
  };
  const schedule = () => {
    if (!ready || disposed) return;
    clearTimeout(timer);
    timer = setTimeout(() => {
      if (!writing) currentWrite = flush();
    }, 300);
  };
  const flush = async () => {
    timer = undefined;
    if (disposed || writing || !ready || key(choices) === saved) return;
    const snapshot = choices;
    const snapshotKey = key(snapshot);
    writing = true;
    try {
      await communityRequest('/api/preferences', controller.signal, {
        method: 'PUT',
        body: snapshot,
      });
      if (!disposed) {
        saved = snapshotKey;
        options.onError('');
      }
    } catch (error) {
      failure(error);
    } finally {
      writing = false;
      if (!disposed && key(choices) !== snapshotKey) schedule();
    }
  };
  const read = async () => {
    if (reading || disposed) return;
    reading = true;
    try {
      const { preferences } = await communityRequest<{
        preferences: StoredMemberPreferences;
      }>('/api/preferences', controller.signal);
      if (disposed) return;
      if (
        !preferences ||
        ![
          preferences.categoryIds,
          preferences.draftVoteIds,
          preferences.submittedVoteIds,
        ].every(
          (values) =>
            Array.isArray(values) &&
            values.every((value) => typeof value === 'string'),
        ) ||
        (preferences.updatedAt !== null &&
          !Number.isFinite(preferences.updatedAt))
      )
        throw new Error('Saved choices could not be read. Please try again.');
      const stored: MemberPreferences = {
        categoryIds: preferences.categoryIds,
        draftVoteIds: preferences.draftVoteIds,
        submittedVoteIds: preferences.submittedVoteIds,
      };
      saved = key(stored);
      choices = {
        categoryIds: unique([...stored.categoryIds, ...choices.categoryIds]),
        draftVoteIds:
          preferences.updatedAt !== null && !votesChanged
            ? [...stored.draftVoteIds]
            : choices.draftVoteIds,
        submittedVoteIds: [...stored.submittedVoteIds],
      };
      ready = true;
      options.onError('');
      options.onRestore({
        draftVoteIds: choices.draftVoteIds,
        submittedVoteIds: choices.submittedVoteIds,
      });
      if (key(choices) !== saved) schedule();
    } catch (error) {
      failure(error);
    } finally {
      reading = false;
    }
  };
  const startRead = () => {
    if (!reading && !disposed) currentRead = read();
  };
  startRead();
  return {
    submitVote(ids: string[]): Promise<string[]> {
      if (currentVote) return currentVote;
      const submittedVoteIds = [...ids];
      const previousWrite = currentWrite;
      const operation = (async () => {
        clearTimeout(timer);
        if (!ready) startRead();
        await currentRead;
        if (previousWrite) await previousWrite;
        if (disposed || !ready)
          throw new CommunityRequestError('Your choices could not be loaded. Please try again.');
        clearTimeout(timer);
        const snapshot = { ...choices, submittedVoteIds };
        writing = true;
        try {
          const { preferences } = await communityRequest<{ preferences: StoredMemberPreferences }>(
            '/api/preferences', controller.signal,
            { method: 'PUT', body: { ...snapshot, submitVote: true } },
          );
          if (disposed) throw new CommunityRequestError('Vote submission was canceled.');
          if (!preferences || !Number.isFinite(preferences.updatedAt) ||
            !Array.isArray(preferences.submittedVoteIds) ||
            JSON.stringify(preferences.submittedVoteIds) !== JSON.stringify(submittedVoteIds))
            throw new CommunityRequestError('The server did not confirm your vote. Please try again.');
          choices = { ...choices, submittedVoteIds };
          saved = key(snapshot);
          options.onError('');
          return [...submittedVoteIds];
        } catch (error) {
          failure(error);
          throw error;
        } finally {
          writing = false;
          if (!disposed && key(choices) !== saved) schedule();
        }
      })();
      currentVote = operation.finally(() => { currentVote = null; });
      currentWrite = currentVote.then(() => {}, () => {});
      return currentVote;
    },
    async flush() {
      clearTimeout(timer);
      if (!ready) await currentRead;
      if (currentWrite) await currentWrite;
      if (disposed || !ready) return;
      clearTimeout(timer);
      currentWrite = flush();
      await currentWrite;
    },
    updateVotes(draftVoteIds: string[], submittedVoteIds: string[]) {
      if (disposed) return;
      const next = {
        ...choices,
        draftVoteIds: unique(draftVoteIds).slice(0, MAX_VOTES),
        submittedVoteIds: unique(submittedVoteIds).slice(0, MAX_VOTES),
      };
      if (key(next) !== key(choices)) {
        votesChanged = true;
        choices = next;
      }
      if (!ready) startRead();
      else schedule();
    },
    recordCategory(categoryId: string) {
      if (!Object.keys(CATEGORIES).includes(categoryId) || disposed) return;
      choices = {
        ...choices,
        categoryIds: unique([...choices.categoryIds, categoryId]),
      };
      if (!ready) startRead();
      else schedule();
    },
    dispose() {
      disposed = true;
      clearTimeout(timer);
      controller.abort();
    },
  };
}
