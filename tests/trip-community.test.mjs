import test from 'node:test';
import assert from 'node:assert/strict';
import { DatabaseSync } from 'node:sqlite';
import { createHash } from 'node:crypto';
import { readdir, readFile } from 'node:fs/promises';
import { createTripCommunityHandlers } from '../lib/trip-community.ts';
import { createTripCommunityStore } from '../lib/trip-community-store.ts';
import { createTripAuthStore } from '../lib/trip-auth-store.ts';
import { authenticateWithStore } from '../lib/trip-auth.ts';

async function fixture() {
  const db = new DatabaseSync(':memory:');
  db.exec('PRAGMA foreign_keys=ON;');
  const folder = new URL('../db/migrations/', import.meta.url);
  for (const file of (await readdir(folder))
    .filter((file) => file.endsWith('.sql'))
    .sort())
    db.exec(await readFile(new URL(file, folder), 'utf8'));
  db.exec(
    "INSERT INTO activities(id,name_ko,name_en,published) VALUES('seoul','서울','Keep this title',1),('busan','부산','Busan',1),('hidden','숨김','Hidden',0);",
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
      return Promise.all(statements.map((statement) => statement.run()));
    },
  };
  let now = 1700000000000;
  const cookies = {};
  for (const [name, role, token] of [
    ['Alex', 'member', '1'],
    ['Shawn', 'admin', '2'],
    ['Sun', 'admin', '3'],
    ['Taylor', 'member', '4'],
  ]) {
    const id = name.toLowerCase();
    db.prepare(
      'INSERT INTO trip_users(id,name,name_key,password_hash,role,created_at) VALUES(?,?,?,?,?,?)',
    ).run(id, name, id, 'fixture-only-hash', role, now);
    const value = token.repeat(64);
    cookies[id] = `ktravel_session=${value}`;
    db.prepare(
      'INSERT INTO trip_sessions(token_hash,user_id,expires_at,created_at) VALUES(?,?,?,?)',
    ).run(
      createHash('sha256').update(value).digest('hex'),
      id,
      now + 86400000,
      now,
    );
  }
  const auth = createTripAuthStore(d1);
  return {
    db,
    cookies,
    advance: (ms) => {
      now += ms;
    },
    handlers: createTripCommunityHandlers(createTripCommunityStore(d1), {
      authenticate: (request) => authenticateWithStore(request, auth, now),
      now: () => now,
    }),
  };
}
function request(
  path,
  method = 'GET',
  body,
  cookie,
  origin = 'http://localhost:3000',
) {
  return new Request(`http://localhost:3000/api/${path}`, {
    method,
    headers: {
      ...(cookie ? { Cookie: cookie } : {}),
      ...(method !== 'GET'
        ? { Origin: origin, 'Content-Type': 'application/json' }
        : {}),
    },
    ...(body ? { body: JSON.stringify(body) } : {}),
  });
}

await test('preferences are validated, persisted for the signed-in member and never expose another member selection', async () => {
  const { db, cookies, handlers } = await fixture();
  assert.equal(
    (await handlers.preferences(request('preferences'))).status,
    401,
  );
  assert.deepEqual(
    await (
      await handlers.preferences(
        request('preferences', 'GET', null, cookies.alex),
      )
    ).json(),
    {
      preferences: {
        categoryIds: [],
        draftVoteIds: [],
        submittedVoteIds: [],
        updatedAt: null,
      },
    },
  );
  const input = {
    categoryIds: ['food', 'history'],
    draftVoteIds: ['seoul'],
    submittedVoteIds: ['busan'],
  };
  const saved = await handlers.preferences(
    request('preferences', 'PUT', input, cookies.alex),
  );
  assert.equal(saved.status, 200);
  assert.deepEqual((await saved.json()).preferences, {
    ...input,
    updatedAt: 1700000000000,
  });
  assert.deepEqual(
    (
      await (
        await handlers.preferences(
          request('preferences', 'GET', null, cookies.taylor),
        )
      ).json()
    ).preferences.draftVoteIds,
    [],
  );
  assert.equal(
    (
      await handlers.preferences(
        request(
          'preferences',
          'PUT',
          { ...input, userId: 'shawn' },
          cookies.alex,
        ),
      )
    ).status,
    400,
  );
  assert.equal(
    (
      await handlers.preferences(
        request(
          'preferences',
          'PUT',
          { ...input, categoryIds: ['all'] },
          cookies.alex,
        ),
      )
    ).status,
    400,
  );
  assert.equal(
    (
      await handlers.preferences(
        request(
          'preferences',
          'PUT',
          { ...input, draftVoteIds: ['hidden'] },
          cookies.alex,
        ),
      )
    ).status,
    400,
  );
  assert.equal(
    (
      await handlers.preferences(
        request(
          'preferences',
          'PUT',
          { ...input, draftVoteIds: ['seoul', 'seoul'] },
          cookies.alex,
        ),
      )
    ).status,
    400,
  );
  db.close();
});

await test('signed-in members send reports as themselves and only Shawn can read or idempotently mark them read', async () => {
  const { db, cookies, handlers, advance } = await fixture();
  assert.equal(
    (await handlers.reports(request('reports', 'POST', { message: 'Help' })))
      .status,
    401,
  );
  for (const cookie of [cookies.alex, cookies.sun, cookies.taylor])
    assert.equal(
      (await handlers.reports(request('reports', 'GET', null, cookie))).status,
      403,
    );
  const sent = await handlers.reports(
    request(
      'reports',
      'POST',
      { message: '  Please clarify the subway transfer.  ' },
      cookies.alex,
    ),
  );
  assert.equal(sent.status, 201);
  const report = (await sent.json()).report;
  assert.deepEqual(
    { ...report, id: 'created-id' },
    {
      id: 'created-id',
      userId: 'alex',
      memberName: 'Alex',
      message: 'Please clarify the subway transfer.',
      createdAt: 1700000000000,
      readAt: null,
    },
  );
  assert.equal(
    (
      await handlers.reports(
        request(
          'reports',
          'POST',
          { message: 'Other', userId: 'shawn' },
          cookies.alex,
        ),
      )
    ).status,
    400,
  );
  assert.equal(
    (
      await handlers.reports(
        request('reports', 'POST', { message: ' '.repeat(10) }, cookies.alex),
      )
    ).status,
    400,
  );
  assert.equal(
    (
      await handlers.reports(
        request('reports', 'POST', { message: 'x'.repeat(2001) }, cookies.alex),
      )
    ).status,
    400,
  );
  assert.equal(
    (
      await handlers.reports(
        request('reports', 'PATCH', { reportIds: [report.id] }, cookies.sun),
      )
    ).status,
    403,
  );
  assert.deepEqual(
    (
      await (
        await handlers.reports(request('reports', 'GET', null, cookies.shawn))
      ).json()
    ).reports,
    [report],
  );
  advance(1000);
  const marked = await handlers.reports(
    request('reports', 'PATCH', { reportIds: [report.id] }, cookies.shawn),
  );
  assert.equal((await marked.json()).reports[0].readAt, 1700000001000);
  advance(1000);
  assert.equal(
    (
      await (
        await handlers.reports(
          request(
            'reports',
            'PATCH',
            { reportIds: [report.id] },
            cookies.shawn,
          ),
        )
      ).json()
    ).reports[0].readAt,
    1700000001000,
  );
  db.close();
});

await test('only Shawn receives registered members and their published preferences without credentials', async () => {
  const { db, cookies, handlers } = await fixture();
  assert.equal((await handlers.members(request('members'))).status, 401);
  for (const cookie of [cookies.alex, cookies.sun])
    assert.equal(
      (await handlers.members(request('members', 'GET', null, cookie))).status,
      403,
    );
  await handlers.preferences(
    request(
      'preferences',
      'PUT',
      {
        categoryIds: ['food'],
        draftVoteIds: ['seoul'],
        submittedVoteIds: ['busan'],
      },
      cookies.alex,
    ),
  );
  db.prepare(
    "INSERT INTO trip_favorites(user_id,activity_id,created_at) VALUES('alex','seoul',1700000000000),('alex','hidden',1700000000000)",
  ).run();
  const response = await handlers.members(
    request('members', 'GET', null, cookies.shawn),
  );
  assert.equal(response.status, 200);
  const { members } = await response.json();
  assert.equal(members.length, 4);
  assert.deepEqual(
    members.find((member) => member.id === 'alex'),
    {
      id: 'alex',
      name: 'Alex',
      role: 'member',
      createdAt: 1700000000000,
      categoryIds: ['food'],
      draftVoteIds: ['seoul'],
      submittedVoteIds: ['busan'],
      favoriteIds: ['seoul'],
    },
  );
  assert.deepEqual(
    members.find((member) => member.id === 'sun'),
    {
      id: 'sun',
      name: 'Sun',
      role: 'admin',
      createdAt: 1700000000000,
      categoryIds: [],
      draftVoteIds: [],
      submittedVoteIds: [],
      favoriteIds: [],
    },
  );
  assert.equal(JSON.stringify(members).includes('fixture-only-hash'), false);
  assert.equal(JSON.stringify(members).includes('password'), false);
  db.prepare("UPDATE activities SET published=0 WHERE id='seoul'").run();
  const updated = (
    await (
      await handlers.members(request('members', 'GET', null, cookies.shawn))
    ).json()
  ).members.find((member) => member.id === 'alex');
  assert.deepEqual(updated.draftVoteIds, []);
  assert.deepEqual(updated.favoriteIds, []);
  db.close();
});

await test('Shawn and Sun can update only the four host review fields on a published activity', async () => {
  const { db, cookies, handlers } = await fixture();
  const input = {
    shawn_comment: '  Wonderful lunch.  ',
    sun_comment: 'A relaxed afternoon.',
    shawn_rating: 5,
    sun_rating: 4,
  };
  assert.equal(
    (
      await handlers.reviews(
        request('activities/seoul/reviews', 'PATCH', input),
        'seoul',
      )
    ).status,
    401,
  );
  assert.equal(
    (
      await handlers.reviews(
        request('activities/seoul/reviews', 'PATCH', input, cookies.alex),
        'seoul',
      )
    ).status,
    403,
  );
  const before = db.prepare("SELECT * FROM activities WHERE id='seoul'").get();
  const response = await handlers.reviews(
    request('activities/seoul/reviews', 'PATCH', input, cookies.shawn),
    'seoul',
  );
  assert.equal(response.status, 200);
  assert.deepEqual(await response.json(), {
    reviews: { ...input, shawn_comment: 'Wonderful lunch.' },
  });
  const after = db.prepare("SELECT * FROM activities WHERE id='seoul'").get();
  for (const key of Object.keys(before).filter(
    (key) =>
      ![
        'shawn_comment',
        'sun_comment',
        'shawn_rating',
        'sun_rating',
        'updated_at',
      ].includes(key),
  ))
    assert.equal(after[key], before[key], `preserves ${key}`);
  const cleared = {
    shawn_comment: null,
    sun_comment: '',
    shawn_rating: null,
    sun_rating: null,
  };
  assert.deepEqual(
    await (
      await handlers.reviews(
        request('activities/seoul/reviews', 'PATCH', cleared, cookies.sun),
        'seoul',
      )
    ).json(),
    {
      reviews: {
        shawn_comment: null,
        sun_comment: null,
        shawn_rating: null,
        sun_rating: null,
      },
    },
  );
  for (const invalid of [
    { ...input, name_en: 'overwrite' },
    { shawn_comment: null },
    { ...input, shawn_rating: 6 },
    { ...input, shawn_rating: 1.5 },
    { ...input, shawn_rating: '5' },
    { ...input, sun_comment: 123 },
    { ...input, sun_comment: 'x'.repeat(10001) },
  ]) {
    assert.equal(
      (
        await handlers.reviews(
          request('activities/seoul/reviews', 'PATCH', invalid, cookies.shawn),
          'seoul',
        )
      ).status,
      400,
    );
  }
  assert.equal(
    (
      await handlers.reviews(
        request('activities/hidden/reviews', 'PATCH', input, cookies.shawn),
        'hidden',
      )
    ).status,
    404,
  );
  assert.equal(
    (
      await handlers.reviews(
        request(
          'activities/seoul/reviews',
          'PATCH',
          input,
          cookies.shawn,
          'https://evil.test',
        ),
        'seoul',
      )
    ).status,
    403,
  );
  db.close();
});

await test('all community writes require same-origin bounded JSON and active server sessions', async () => {
  const { db, cookies, handlers } = await fixture();
  const writes = [
    [
      'preferences',
      'PUT',
      { categoryIds: [], draftVoteIds: [], submittedVoteIds: [] },
      cookies.alex,
      (req) => handlers.preferences(req),
    ],
    [
      'reports',
      'POST',
      { message: 'Help' },
      cookies.alex,
      (req) => handlers.reports(req),
    ],
    [
      'reports',
      'PATCH',
      { reportIds: [] },
      cookies.shawn,
      (req) => handlers.reports(req),
    ],
    [
      'activities/seoul/reviews',
      'PATCH',
      {
        shawn_comment: null,
        sun_comment: null,
        shawn_rating: null,
        sun_rating: null,
      },
      cookies.shawn,
      (req) => handlers.reviews(req, 'seoul'),
    ],
  ];
  for (const [path, method, input, cookie, handle] of writes) {
    assert.equal(
      (await handle(request(path, method, input, cookie, 'https://evil.test')))
        .status,
      403,
    );
    const missingOrigin = request(path, method, input, cookie);
    missingOrigin.headers.delete('origin');
    assert.equal((await handle(missingOrigin)).status, 403);
    const wrongType = request(path, method, input, cookie);
    wrongType.headers.set('Content-Type', 'text/plain');
    assert.equal((await handle(wrongType)).status, 400);
    const oversized = new Request(`http://localhost:3000/api/${path}`, {
      method,
      headers: {
        Origin: 'http://localhost:3000',
        'Content-Type': 'application/json',
        Cookie: cookie,
      },
      body: JSON.stringify({ padding: 'x'.repeat(65536) }),
    });
    assert.equal((await handle(oversized)).status, 400);
    const malformed = new Request(`http://localhost:3000/api/${path}`, {
      method,
      headers: {
        Origin: 'http://localhost:3000',
        'Content-Type': 'application/json',
        Cookie: cookie,
      },
      body: '{',
    });
    assert.equal((await handle(malformed)).status, 400);
  }
  db.prepare('UPDATE trip_sessions SET expires_at=0').run();
  for (const [path, method, input, cookie, handle] of writes)
    assert.equal(
      (await handle(request(path, method, input, cookie))).status,
      401,
    );
  assert.equal(
    (await handlers.members(request('members', 'GET', null, cookies.shawn)))
      .status,
    401,
  );
  db.close();
});

await test('list limits and persistent report throttling reject spam without inserting extra reports', async () => {
  const { db, cookies, handlers, advance } = await fixture();
  const input = { categoryIds: [], draftVoteIds: [], submittedVoteIds: [] };
  for (const invalid of [
    { ...input, categoryIds: ['food', 'food'] },
    { ...input, categoryIds: [1] },
    {
      ...input,
      draftVoteIds: Array.from(
        { length: 21 },
        (_, index) => `activity-${index}`,
      ),
    },
    { ...input, submittedVoteIds: ['missing'] },
  ]) {
    assert.equal(
      (
        await handlers.preferences(
          request('preferences', 'PUT', invalid, cookies.alex),
        )
      ).status,
      400,
    );
  }
  assert.equal(
    (
      await handlers.reports(
        request(
          'reports',
          'PATCH',
          {
            reportIds: Array.from({ length: 101 }, (_, index) =>
              `${index}`.padStart(36, '0'),
            ),
          },
          cookies.shawn,
        ),
      )
    ).status,
    400,
  );
  assert.equal(
    (
      await handlers.reports(
        request(
          'reports',
          'PATCH',
          { reportIds: ['not-an-id'] },
          cookies.shawn,
        ),
      )
    ).status,
    400,
  );
  for (let index = 0; index < 10; index++)
    assert.equal(
      (
        await handlers.reports(
          request(
            'reports',
            'POST',
            { message: `Report ${index}` },
            cookies.alex,
          ),
        )
      ).status,
      201,
    );
  const rejected = await handlers.reports(
    request('reports', 'POST', { message: 'One too many' }, cookies.alex),
  );
  assert.equal(rejected.status, 429);
  assert.equal(
    db.prepare('SELECT count(*) AS count FROM trip_reports').get().count,
    10,
  );
  assert.equal(
    (
      await handlers.reports(
        request(
          'reports',
          'POST',
          { message: 'Independent member' },
          cookies.taylor,
        ),
      )
    ).status,
    201,
  );
  advance(15 * 60000);
  assert.equal(
    (
      await handlers.reports(
        request(
          'reports',
          'POST',
          { message: 'After the limit expires' },
          cookies.alex,
        ),
      )
    ).status,
    201,
  );
  db.close();
});

await test('the report inbox is bounded and prioritizes unread reports, and the additive migration is idempotent', async () => {
  const { db, cookies, handlers } = await fixture();
  const insert = db.prepare(
    'INSERT INTO trip_reports(id,user_id,message,created_at,read_at) VALUES(?,?,?,?,?)',
  );
  for (let index = 0; index < 205; index++)
    insert.run(
      `report-${index}`,
      'alex',
      `Report ${index}`,
      index,
      index === 0 ? null : 1000,
    );
  const before = db.prepare("SELECT * FROM activities WHERE id='seoul'").get();
  const migration = await readFile(
    new URL('../db/migrations/0006_trip_community.sql', import.meta.url),
    'utf8',
  );
  db.exec(migration);
  db.exec(migration);
  assert.deepEqual(
    db.prepare("SELECT * FROM activities WHERE id='seoul'").get(),
    before,
  );
  const response = await handlers.reports(
    request('reports', 'GET', null, cookies.shawn),
  );
  assert.equal(response.headers.get('Cache-Control'), 'no-store');
  const { reports } = await response.json();
  assert.equal(reports.length, 200);
  assert.equal(reports[0].id, 'report-0');
  assert.equal(reports[1].createdAt, 204);
  db.close();
});

await test('storage errors return a private generic failure without leaking SQL or user data', async () => {
  const { db, cookies, handlers } = await fixture();
  db.exec('DROP TABLE trip_member_preferences');
  const response = await handlers.members(
    request('members', 'GET', null, cookies.shawn),
  );
  assert.equal(response.status, 503);
  assert.equal(response.headers.get('Cache-Control'), 'no-store');
  assert.equal(response.headers.get('Vary'), 'Cookie');
  assert.deepEqual(await response.json(), {
    error: 'This request is temporarily unavailable.',
  });
  db.close();
});
