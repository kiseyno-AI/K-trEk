import test from 'node:test';
import assert from 'node:assert/strict';
import { DatabaseSync } from 'node:sqlite';
import { readFile, mkdtemp, rm, stat } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { spawnSync } from 'node:child_process';
import { createTripAuthHandlers, hashTripPassword } from '../lib/trip-auth.ts';
import { createTripAuthStore } from '../lib/trip-auth-store.ts';

async function fixture() {
  const db = new DatabaseSync(':memory:');
  db.exec(
    "PRAGMA foreign_keys=ON; CREATE TABLE activities(id TEXT PRIMARY KEY,published INTEGER NOT NULL); INSERT INTO activities VALUES ('seoul',1),('hidden',0);",
  );
  db.exec(
    await readFile(
      new URL('../db/migrations/0005_trip_accounts.sql', import.meta.url),
      'utf8',
    ),
  );
  const d1 = {
    prepare(sql) {
      let values = [];
      return {
        bind(...params) {
          values = params;
          return this;
        },
        async first() {
          return db.prepare(sql).get(...values) ?? null;
        },
        async all() {
          return { results: db.prepare(sql).all(...values) };
        },
        async run() {
          return { meta: { changes: db.prepare(sql).run(...values).changes } };
        },
      };
    },
    async batch(statements) {
      return Promise.all(statements.map((s) => s.run()));
    },
  };
  let now = Date.parse('2026-11-16T12:00:00Z');
  const store = createTripAuthStore(d1);
  return {
    db,
    store,
    handlers: createTripAuthHandlers(store, { now: () => now }),
    advance: (ms) => {
      now += ms;
    },
  };
}
function request(
  path,
  method = 'GET',
  body,
  cookie,
  origin = 'https://shawnai.win',
) {
  return new Request(`https://shawnai.win/ktravel/api/${path}`, {
    method,
    headers: {
      ...(method !== 'GET'
        ? { 'Content-Type': 'application/json', Origin: origin }
        : {}),
      ...(cookie ? { Cookie: cookie } : {}),
    },
    ...(body ? { body: JSON.stringify(body) } : {}),
  });
}
const cookieFrom = (response) =>
  response.headers.get('set-cookie').split(';')[0];

await test('members can register and sign in with one-character or longer-than128-character passwords within the request budget', async () => {
  const { handlers, db } = await fixture();
  for (const [name, password] of [
    ['Short', 'x'],
    ['Long', 'z'.repeat(3000)],
  ]) {
    const registered = await handlers.session(
      request('session', 'POST', { name, password }),
    );
    assert.equal(registered.status, 201);
    const member = (await registered.json()).user;
    const signedIn = await handlers.session(
      request('session', 'POST', { name, password }),
    );
    assert.equal(signedIn.status, 200);
    assert.equal((await signedIn.json()).user.id, member.id);
    const wrong = await handlers.session(
      request('session', 'POST', {
        name,
        password: password.length === 1 ? 'y' : password.slice(0, 128),
      }),
    );
    assert.equal(wrong.status, 401);
  }
  db.close();
});

await test('a first name creates a member, then the same normalized name requires its original password and a revocable session', async () => {
  const { handlers, db } = await fixture();
  const lookup = await handlers.name(
    request('session/name', 'POST', { name: '  Alex  ' }),
  );
  assert.deepEqual(await lookup.json(), { name: 'Alex', exists: false });
  const created = await handlers.session(
    request('session', 'POST', {
      name: 'Alex',
      password: 'A sufficiently long password',
    }),
  );
  assert.equal(created.status, 201);
  const member = (await created.json()).user;
  assert.equal(member.role, 'member');
  assert.equal(member.name, 'Alex');
  assert.deepEqual(Object.keys(member).sort(), ['id', 'name', 'role']);
  assert.match(
    created.headers.get('set-cookie'),
    /Path=\/ktravel; HttpOnly; SameSite=Lax; Max-Age=1209600; Secure/,
  );
  const cookie = cookieFrom(created);
  const current = await handlers.session(
    request('session', 'GET', null, cookie),
  );
  assert.deepEqual((await current.json()).user, member);
  const failed = await handlers.session(
    request('session', 'POST', {
      name: 'ＡＬＥＸ',
      password: 'A different long password',
    }),
  );
  assert.equal(failed.status, 401);
  const login = await handlers.session(
    request('session', 'POST', {
      name: 'alex',
      password: 'A sufficiently long password',
    }),
  );
  assert.equal(login.status, 200);
  assert.equal((await login.json()).user.id, member.id);
  const logout = await handlers.session(
    request('session', 'DELETE', null, cookie),
  );
  assert.equal(logout.status, 200);
  assert.equal(
    (
      await (
        await handlers.session(request('session', 'GET', null, cookie))
      ).json()
    ).user,
    null,
  );
  db.close();
});

await test('favorites belong to the signed-in member and visitors cannot write or see another member selection', async () => {
  const { handlers, db } = await fixture();
  assert.equal((await handlers.favorites(request('favorites'))).status, 401);
  const alex = await handlers.session(
    request('session', 'POST', {
      name: 'Alex',
      password: 'A sufficiently long password',
    }),
  );
  const cookie = cookieFrom(alex);
  const saved = await handlers.favorites(
    request(
      'favorites',
      'PUT',
      { activityId: 'seoul', favorite: true },
      cookie,
    ),
  );
  assert.deepEqual(await saved.json(), { favoriteIds: ['seoul'] });
  assert.deepEqual(
    await (
      await handlers.favorites(request('favorites', 'GET', null, cookie))
    ).json(),
    { favoriteIds: ['seoul'] },
  );
  const taylor = await handlers.session(
    request('session', 'POST', {
      name: 'Taylor',
      password: 'A sufficiently long password',
    }),
  );
  assert.deepEqual(
    await (
      await handlers.favorites(
        request('favorites', 'GET', null, cookieFrom(taylor)),
      )
    ).json(),
    { favoriteIds: [] },
  );
  assert.equal(
    (
      await handlers.favorites(
        request(
          'favorites',
          'PUT',
          { activityId: 'hidden', favorite: true },
          cookie,
        ),
      )
    ).status,
    404,
  );
  assert.equal(
    (
      await handlers.favorites(
        request(
          'favorites',
          'PUT',
          { activityId: 'seoul', favorite: true },
          cookie,
          'https://other.example',
        ),
      )
    ).status,
    403,
  );
  assert.deepEqual(
    await (
      await handlers.favorites(
        request(
          'favorites',
          'PUT',
          { activityId: 'seoul', favorite: false },
          cookie,
        ),
      )
    ).json(),
    { favoriteIds: [] },
  );
  db.close();
});

await test('an existing empty administrator password is set once while preserving the account and favorites', async () => {
  const { handlers, db } = await fixture();
  db.prepare(
    "INSERT INTO trip_users(id,name,name_key,password_hash,role,created_at) VALUES('shawn-original','Shawn','shawn','','admin',1)",
  ).run();
  db.prepare(
    "INSERT INTO trip_favorites(user_id,activity_id,created_at) VALUES('shawn-original','seoul',1)",
  ).run();
  for (let viewer = 0; viewer < 2; viewer++) {
    const lookup = await handlers.name(
      request('session/name', 'POST', { name: 'ＳＨＡＷＮ' }),
    );
    assert.equal((await lookup.json()).exists, false);
  }
  const first = await handlers.session(
    request('session', 'POST', { name: 'shawn', password: 'a' }),
  );
  assert.equal(first.status, 200);
  assert.deepEqual((await first.json()).user, {
    id: 'shawn-original',
    name: 'Shawn',
    role: 'admin',
  });
  const cookie = cookieFrom(first);
  assert.deepEqual(
    await (
      await handlers.favorites(request('favorites', 'GET', null, cookie))
    ).json(),
    { favoriteIds: ['seoul'] },
  );
  assert.equal(
    (
      await (
        await handlers.name(request('session/name', 'POST', { name: 'Shawn' }))
      ).json()
    ).exists,
    true,
  );
  assert.equal(
    (
      await handlers.session(
        request('session', 'POST', { name: 'Shawn', password: 'b' }),
      )
    ).status,
    401,
  );
  assert.equal(
    (
      await handlers.session(
        request('session', 'POST', { name: 'Shawn', password: 'a' }),
      )
    ).status,
    200,
  );
  assert.equal(
    db.prepare("SELECT id FROM trip_users WHERE name_key='shawn'").get().id,
    'shawn-original',
  );
  db.close();
});

await test('administrator roles come only from normalized Shawn and Sun names, never a client role field', async () => {
  const { handlers, db } = await fixture();
  for (const name of ['Shawn', 'ＳＵＮ']) {
    assert.equal(
      (
        await (
          await handlers.name(request('session/name', 'POST', { name }))
        ).json()
      ).exists,
      false,
    );
    const created = await handlers.session(
      request('session', 'POST', { name, password: 'x' }),
    );
    assert.equal(created.status, 201);
    assert.equal((await created.json()).user.role, 'admin');
    assert.equal(
      (
        await (
          await handlers.name(request('session/name', 'POST', { name }))
        ).json()
      ).exists,
      true,
    );
  }
  assert.equal(
    (
      await handlers.session(
        request('session', 'POST', {
          name: 'Alex',
          password: 'x',
          role: 'admin',
        }),
      )
    ).status,
    400,
  );
  const member = await handlers.session(
    request('session', 'POST', { name: 'Alex', password: 'x' }),
  );
  assert.equal((await member.json()).user.role, 'member');
  assert.equal(
    db.prepare('SELECT count(*) AS total FROM trip_users').get().total,
    3,
  );
  db.close();
});

await test('session tokens are hashed at rest, expire, reject duplicates and obey the public proxy cookie scope', async () => {
  const { handlers, db, advance } = await fixture();
  const signed = await handlers.session(
    request('session', 'POST', {
      name: 'Alex',
      password: 'A sufficiently long password',
    }),
  );
  const cookie = cookieFrom(signed);
  const token = cookie.split('=')[1];
  const stored = db
    .prepare('SELECT token_hash FROM trip_sessions')
    .get().token_hash;
  assert.ok(stored !== token);
  assert.equal(
    (
      await (
        await handlers.session(
          request('session', 'GET', null, `${cookie}; ${cookie}`),
        )
      ).json()
    ).user,
    null,
  );
  advance(14 * 86400000 + 1);
  assert.equal(
    (
      await (
        await handlers.session(request('session', 'GET', null, cookie))
      ).json()
    ).user,
    null,
  );
  const proxied = new Request('http://127.0.0.1:4330/api/session', {
    method: 'POST',
    headers: {
      Host: 'shawnai.win',
      'X-Forwarded-Host': 'shawnai.win',
      'X-Forwarded-Proto': 'https',
      Origin: 'https://shawnai.win',
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      name: 'Jamie',
      password: 'A sufficiently long password',
    }),
  });
  const response = await handlers.session(proxied);
  assert.equal(response.status, 201);
  assert.match(
    response.headers.get('set-cookie'),
    /Path=\/ktravel; HttpOnly; SameSite=Lax; Max-Age=1209600; Secure/,
  );
  const local = new Request('http://localhost:3000/api/session', {
    method: 'POST',
    headers: {
      Origin: 'http://localhost:3000',
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      name: 'Robin',
      password: 'A sufficiently long password',
    }),
  });
  assert.match(
    (await handlers.session(local)).headers.get('set-cookie'),
    /Path=\/; HttpOnly; SameSite=Lax; Max-Age=1209600$/,
  );
  db.close();
});

await test('bad payloads are bounded before hashing and repeated password attempts recover after their window', async () => {
  const { handlers, db, advance } = await fixture();
  for (const password of [null, false, 7, [], {}]) {
    assert.equal(
      (
        await handlers.session(
          request('session', 'POST', { name: 'Alex', password }),
        )
      ).status,
      400,
    );
  }
  assert.equal(
    (
      await handlers.session(
        request('session', 'POST', { name: 'Alex', password: '' }),
      )
    ).status,
    400,
  );
  assert.equal(
    (await handlers.name(request('session/name', 'POST', { name: '<script>' })))
      .status,
    400,
  );
  assert.equal(
    (
      await handlers.session(
        request('session', 'POST', {
          name: 'Alex',
          password: 'x'.repeat(5000),
        }),
      )
    ).status,
    400,
  );
  assert.equal(
    db.prepare('SELECT count(*) AS total FROM trip_users').get().total,
    0,
  );
  await handlers.session(
    request('session', 'POST', {
      name: 'Alex',
      password: 'A sufficiently long password',
    }),
  );
  for (let i = 0; i < 9; i++)
    assert.equal(
      (
        await handlers.session(
          request('session', 'POST', {
            name: 'Alex',
            password: 'An incorrect long password',
          }),
        )
      ).status,
      401,
    );
  const blocked = await handlers.session(
    request('session', 'POST', {
      name: 'Alex',
      password: 'A sufficiently long password',
    }),
  );
  assert.equal(blocked.status, 429);
  assert.ok(Number(blocked.headers.get('retry-after')) > 0);
  advance(900001);
  assert.equal(
    (
      await handlers.session(
        request('session', 'POST', {
          name: 'Alex',
          password: 'A sufficiently long password',
        }),
      )
    ).status,
    200,
  );
  db.close();
});

await test('concurrent initial password claims have exactly one winner and cannot change a member password', async () => {
  const { handlers, store, db } = await fixture();
  db.prepare(
    "INSERT INTO trip_users(id,name,name_key,password_hash,role,created_at) VALUES('sun-original','Sun','sun','','admin',1)",
  ).run();
  const hashes = [await hashTripPassword('a'), await hashTripPassword('b')];
  const results = await Promise.all(
    hashes.map((hash) => store.setInitialPassword('sun-original', 'sun', hash)),
  );
  assert.equal(results.filter(Boolean).length, 1);
  const winner = results.findIndex(Boolean);
  assert.equal(
    db
      .prepare("SELECT password_hash FROM trip_users WHERE id='sun-original'")
      .get().password_hash,
    hashes[winner],
  );
  assert.equal(
    (
      await handlers.session(
        request('session', 'POST', {
          name: 'Sun',
          password: winner === 0 ? 'a' : 'b',
        }),
      )
    ).status,
    200,
  );
  assert.equal(
    (
      await handlers.session(
        request('session', 'POST', {
          name: 'Sun',
          password: winner === 0 ? 'b' : 'a',
        }),
      )
    ).status,
    401,
  );
  const created = await handlers.session(
    request('session', 'POST', { name: 'Alex', password: 'x' }),
  );
  const member = (await created.json()).user;
  assert.equal(
    await store.setInitialPassword(member.id, 'alex', hashes[0]),
    false,
  );
  assert.equal(
    (
      await handlers.session(
        request('session', 'POST', { name: 'Alex', password: 'x' }),
      )
    ).status,
    200,
  );
  db.close();
});

await test('local administrator preparation creates empty setup records without passwords or credential files and preserves configured accounts', async () => {
  const directory = await mkdtemp(join(tmpdir(), 'ktravel-admin-test-'));
  const databasePath = join(directory, 'accounts.sqlite');
  const database = new DatabaseSync(databasePath);
  database.exec(
    'CREATE TABLE activities(id TEXT PRIMARY KEY,published INTEGER NOT NULL);',
  );
  database.exec(
    await readFile(
      new URL('../db/migrations/0005_trip_accounts.sql', import.meta.url),
      'utf8',
    ),
  );
  database.close();
  const run = () =>
    spawnSync(
      process.execPath,
      [
        '--experimental-strip-types',
        'scripts/provision-trip-admins.mjs',
        '--database',
        databasePath,
      ],
      { cwd: new URL('../', import.meta.url), encoding: 'utf8' },
    );
  try {
    const first = run();
    assert.equal(first.status, 0);
    await assert.rejects(stat(join(directory, 'private')), { code: 'ENOENT' });
    const provisioned = new DatabaseSync(databasePath);
    const rows = provisioned
      .prepare('SELECT * FROM trip_users ORDER BY name_key')
      .all();
    assert.equal(rows.length, 2);
    assert.ok(
      rows.every((row) => row.role === 'admin' && row.password_hash === ''),
    );
    const hash = await hashTripPassword('owner choice');
    provisioned
      .prepare("UPDATE trip_users SET password_hash=? WHERE name_key='shawn'")
      .run(hash);
    const before = provisioned
      .prepare('SELECT * FROM trip_users ORDER BY name_key')
      .all();
    provisioned.close();
    const second = run();
    assert.equal(second.status, 0);
    const after = new DatabaseSync(databasePath);
    assert.deepEqual(
      after.prepare('SELECT * FROM trip_users ORDER BY name_key').all(),
      before,
    );
    after.close();
    assert.doesNotMatch(
      first.stdout + first.stderr + second.stdout + second.stderr,
      /owner choice|scrypt\$/,
    );
  } finally {
    await rm(directory, { recursive: true, force: true });
  }
});
