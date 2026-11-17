import {
  createHash,
  randomBytes,
  randomUUID,
  scrypt,
  timingSafeEqual,
} from 'node:crypto';

export type TripUser = { id: string; name: string; role: 'member' | 'admin' };
export type StoredTripUser = TripUser & {
  name_key: string;
  password_hash: string;
};
export type TripAuthStore = {
  findUser(nameKey: string): Promise<StoredTripUser | null>;
  createUser(user: StoredTripUser, now: number): Promise<boolean>;
  setInitialPassword(
    userId: string,
    nameKey: string,
    passwordHash: string,
  ): Promise<boolean>;
  createSession(
    tokenHash: string,
    userId: string,
    expiresAt: number,
    now: number,
  ): Promise<void>;
  sessionUser(tokenHash: string, now: number): Promise<TripUser | null>;
  revokeSession(tokenHash: string): Promise<void>;
  consumeLimit(
    keyHash: string,
    now: number,
    expiresAt: number,
  ): Promise<number>;
  favorites(userId: string): Promise<string[]>;
  setFavorite(
    userId: string,
    activityId: string,
    favorite: boolean,
    now: number,
  ): Promise<boolean>;
};

const SESSION_SECONDS = 14 * 86400;
const RESERVED_NAMES = new Set(['shawn', 'sun']);
let hashing = false;
class AuthError extends Error {
  readonly status: number;
  readonly retryAfter?: number;
  constructor(message: string, status = 400, retryAfter?: number) {
    super(message);
    this.status = status;
    this.retryAfter = retryAfter;
  }
}
const sha256 = (text: string) =>
  createHash('sha256').update(text).digest('hex');
const publicUser = ({ id, name, role }: TripUser): TripUser => ({
  id,
  name,
  role,
});

export function normalizeTripName(input: unknown) {
  if (typeof input !== 'string') throw new AuthError('Enter your first name.');
  const name = input.normalize('NFKC').trim().replace(/\s+/gu, ' ');
  if (
    !name ||
    name.length > 40 ||
    !/^[\p{L}\p{M}\p{N}][\p{L}\p{M}\p{N} '\u2019-]*$/u.test(name)
  )
    throw new AuthError(
      'Use 1–40 letters, numbers, spaces, apostrophes or hyphens for your name.',
    );
  return { name, nameKey: name.toLowerCase() };
}
function passwordValue(input: unknown) {
  if (typeof input !== 'string' || input.length === 0)
    throw new AuthError('Enter a password.');
  return input;
}
async function derive(password: string, salt: string): Promise<Buffer> {
  if (hashing)
    throw new AuthError(
      'Sign-in is busy. Please try again in a moment.',
      429,
      1,
    );
  hashing = true;
  try {
    return await new Promise<Buffer>((resolve, reject) => {
      scrypt(
        password,
        Buffer.from(salt, 'hex'),
        32,
        { N: 32768, r: 8, p: 3, maxmem: 64 * 1024 * 1024 },
        (error, key) => (error ? reject(error) : resolve(key)),
      );
    });
  } finally {
    hashing = false;
  }
}
export async function hashTripPassword(password: string): Promise<string> {
  passwordValue(password);
  const salt = randomBytes(16).toString('hex');
  const key = await derive(password, salt);
  return `scrypt$32768$8$3$${salt}$${key.toString('hex')}`;
}
async function verifyPassword(
  password: string,
  encoded: string,
): Promise<boolean> {
  const match = /^scrypt\$32768\$8\$3\$([a-f0-9]{32})\$([a-f0-9]{64})$/.exec(
    encoded,
  );
  if (!match) return false;
  return timingSafeEqual(
    await derive(password, match[1]),
    Buffer.from(match[2], 'hex'),
  );
}

export function tripRequestOrigin(
  request: Pick<Request, 'url' | 'headers'>,
): string {
  const url = new URL(request.url);
  const loopback = ['localhost', '127.0.0.1', '[::1]'].includes(url.hostname);
  const forwardedHost =
    request.headers.get('x-forwarded-host') || request.headers.get('host');
  if (
    (url.hostname === 'shawnai.win' ||
      (loopback && forwardedHost === 'shawnai.win')) &&
    request.headers.get('x-forwarded-proto') === 'https'
  )
    return 'https://shawnai.win';
  return url.origin;
}
function assertSameOrigin(request: Request) {
  if (request.headers.get('origin') !== tripRequestOrigin(request))
    throw new AuthError('Use the trip website to make this request.', 403);
}
async function jsonBody(request: Request): Promise<Record<string, unknown>> {
  if (
    !request.headers
      .get('content-type')
      ?.toLowerCase()
      .startsWith('application/json')
  )
    throw new AuthError('Send application/json.');
  if (Number(request.headers.get('content-length')) > 4096)
    throw new AuthError('The sign-in request is too large.');
  const reader = request.body?.getReader();
  if (!reader) throw new AuthError('Request data is required.');
  let size = 0;
  const chunks: Uint8Array[] = [];
  try {
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      size += value.byteLength;
      if (size > 4096) {
        await reader.cancel();
        throw new AuthError('The sign-in request is too large.');
      }
      chunks.push(value);
    }
    const bytes = new Uint8Array(size);
    let position = 0;
    for (const chunk of chunks) {
      bytes.set(chunk, position);
      position += chunk.length;
    }
    const value: unknown = JSON.parse(new TextDecoder().decode(bytes));
    if (!value || typeof value !== 'object' || Array.isArray(value))
      throw new Error();
    return value as Record<string, unknown>;
  } catch (error) {
    if (error instanceof AuthError) throw error;
    throw new AuthError('Send a valid JSON object.');
  } finally {
    reader.releaseLock();
  }
}
function onlyKeys(body: Record<string, unknown>, keys: string[]) {
  if (Object.keys(body).some((key) => !keys.includes(key)))
    throw new AuthError('The request contains unsupported fields.');
}
export function tripSessionToken(
  request: Pick<Request, 'headers'>,
): string | null {
  const values = (request.headers.get('cookie') || '')
    .split(';')
    .map((part) => part.trim())
    .filter((part) => part.startsWith('ktravel_session='));
  if (values.length !== 1) return null;
  const value = values[0].slice('ktravel_session='.length);
  return /^[a-f0-9]{64}$/.test(value) ? value : null;
}
export async function authenticateWithStore(
  request: Pick<Request, 'headers'>,
  store: TripAuthStore,
  now = Date.now(),
): Promise<TripUser | null> {
  const token = tripSessionToken(request);
  return token ? store.sessionUser(sha256(token), now) : null;
}
function sessionCookie(request: Request, token: string, seconds: number) {
  const origin = new URL(tripRequestOrigin(request));
  const local = ['localhost', '127.0.0.1', '[::1]'].includes(origin.hostname);
  return `ktravel_session=${token}; Path=${local ? '/' : '/ktravel'}; HttpOnly; SameSite=Lax; Max-Age=${seconds}${origin.protocol === 'https:' ? '; Secure' : ''}`;
}

export function createTripAuthHandlers(
  store: TripAuthStore,
  options: { now?: () => number } = {},
) {
  const now = options.now ?? Date.now;
  const reply = (body: unknown, status = 200, cookie?: string) =>
    Response.json(body, {
      status,
      headers: {
        'Cache-Control': 'no-store',
        Pragma: 'no-cache',
        Vary: 'Cookie',
        'X-Content-Type-Options': 'nosniff',
        ...(cookie ? { 'Set-Cookie': cookie } : {}),
      },
    });
  const guarded =
    (handle: (request: Request) => Promise<Response>) =>
    async (request: Request) => {
      try {
        return await handle(request);
      } catch (error) {
        if (error instanceof AuthError) {
          const response = reply({ error: error.message }, error.status);
          if (error.retryAfter)
            response.headers.set('Retry-After', String(error.retryAfter));
          return response;
        }
        return reply(
          { error: 'Sign-in is temporarily unavailable. Please try again.' },
          503,
        );
      }
    };
  const limit = async (key: string, count: number, windowMs: number) => {
    const time = now();
    if ((await store.consumeLimit(sha256(key), time, time + windowMs)) > count)
      throw new AuthError(
        'Too many attempts. Please try again later.',
        429,
        Math.ceil(windowMs / 1000),
      );
  };
  const client = (request: Request) =>
    request.headers.get('cf-connecting-ip') || 'shared-client';
  const member = async (request: Request) => {
    const user = await authenticateWithStore(request, store, now());
    if (!user) throw new AuthError('Sign in to use this feature.', 401);
    return user;
  };
  return {
    name: guarded(async (request) => {
      if (request.method !== 'POST')
        return reply({ error: 'Method not allowed.' }, 405);
      assertSameOrigin(request);
      const body = await jsonBody(request);
      onlyKeys(body, ['name']);
      const { name, nameKey } = normalizeTripName(body.name);
      await limit('lookup:global', 600, 60000);
      await limit(`lookup:${client(request)}`, 120, 300000);
      const user = await store.findUser(nameKey);
      const needsInitialPassword =
        RESERVED_NAMES.has(nameKey) &&
        user?.role === 'admin' &&
        user.password_hash === '';
      return reply({ name, exists: Boolean(user && !needsInitialPassword) });
    }),
    session: guarded(async (request) => {
      if (request.method === 'GET')
        return reply({
          user: await authenticateWithStore(request, store, now()),
        });
      if (request.method === 'DELETE') {
        assertSameOrigin(request);
        const token = tripSessionToken(request);
        if (token) await store.revokeSession(sha256(token));
        return reply({ user: null }, 200, sessionCookie(request, '', 0));
      }
      if (request.method !== 'POST')
        return reply({ error: 'Method not allowed.' }, 405);
      assertSameOrigin(request);
      const body = await jsonBody(request);
      onlyKeys(body, ['name', 'password']);
      const { name, nameKey } = normalizeTripName(body.name);
      const password = passwordValue(body.password);
      await limit('signin:global', 120, 60000);
      await limit(`signin:${client(request)}`, 60, 900000);
      await limit(`name:${nameKey}`, 10, 900000);
      let user = await store.findUser(nameKey);
      const creating = !user;
      if (!user) {
        user = {
          id: randomUUID(),
          name,
          name_key: nameKey,
          password_hash: await hashTripPassword(password),
          role: RESERVED_NAMES.has(nameKey) ? 'admin' : 'member',
        };
        if (!(await store.createUser(user, now())))
          throw new AuthError(
            'This name was just registered. Enter its password to sign in.',
            409,
          );
      } else if (
        RESERVED_NAMES.has(nameKey) &&
        user.role === 'admin' &&
        user.password_hash === ''
      ) {
        if (
          !(await store.setInitialPassword(
            user.id,
            nameKey,
            await hashTripPassword(password),
          ))
        )
          throw new AuthError(
            'This password was just set. Enter it to sign in.',
            409,
          );
      } else if (!(await verifyPassword(password, user.password_hash)))
        throw new AuthError(
          'The password is incorrect. Please try again.',
          401,
        );
      const token = randomBytes(32).toString('hex');
      const oldToken = tripSessionToken(request);
      if (oldToken) await store.revokeSession(sha256(oldToken));
      await store.createSession(
        sha256(token),
        user.id,
        now() + SESSION_SECONDS * 1000,
        now(),
      );
      return reply(
        { user: publicUser(user) },
        creating ? 201 : 200,
        sessionCookie(request, token, SESSION_SECONDS),
      );
    }),
    favorites: guarded(async (request) => {
      if (!['GET', 'PUT'].includes(request.method))
        return reply({ error: 'Method not allowed.' }, 405);
      if (request.method === 'PUT') assertSameOrigin(request);
      const user = await member(request);
      if (request.method === 'PUT') {
        const body = await jsonBody(request);
        onlyKeys(body, ['activityId', 'favorite']);
        if (
          typeof body.activityId !== 'string' ||
          !/^[a-z0-9][a-z0-9-]{0,99}$/.test(body.activityId) ||
          typeof body.favorite !== 'boolean'
        )
          throw new AuthError('Choose a valid activity and favorite state.');
        await limit(`favorites:${user.id}`, 120, 60000);
        if (
          !(await store.setFavorite(
            user.id,
            body.activityId,
            body.favorite,
            now(),
          ))
        )
          throw new AuthError('This activity is unavailable.', 404);
      }
      return reply({ favoriteIds: await store.favorites(user.id) });
    }),
  };
}
