# Korea Travel accounts — 2026-11-16

The name-first flow uses the existing local D1 database with additive account, session, favorite and authentication-limit tables. Activity content is unchanged. An account is established only after a nonempty password is supplied. Its role comes from the normalized name: Shawn/Sun are administrators and every other name is a member, following the owner’s explicit name-based override. Existing names require their original password. Names are NFKC-normalized, trimmed, case-insensitive and limited to40characters; passwords retain their original Unicode/spacing and must be nonempty strings. The owner explicitly removed password character-count restrictions: a one-character password is accepted and passwords longer than128characters are not truncated. The JSON request remains bounded to4096bytes; this is a transport/resource limit, not a password-length policy.

## Public interface

- `POST /api/session/name {name}` → `{name,exists}`. An existing administrator with an empty password hash, or a missing name, returns exists:false so its first password can be entered. Once a hash is set, exists:true requires that password.
- `POST /api/session {name,password}` → `{user:{id,name,role}}` and an HttpOnly cookie. Status201 for a new member,200 for an existing user. Client role/ID/unsupported fields are rejected.
- `GET /api/session` → `{user:null|{id,name,role}}`.
- `DELETE /api/session` revokes the current session and clears its cookie.
- `GET /api/favorites` → `{favoriteIds:string[]}` for the authenticated member.
- `PUT /api/favorites {activityId,favorite:boolean}` toggles a published existing activity for the authenticated member and returns that member's current list.

Errors contain only `{error:string}`, with400/401/403/404/409/429/503 as appropriate; throttling adds Retry-After. Auth/favorites responses are no-store. All writes require same Origin. `tripRequestOrigin` accounts for the trusted proxy's fixed shawnai.win Host/X-Forwarded-Proto while retaining raw localhost origins; it does not trust arbitrary forwarded hosts.

`authenticateRequest(request)` in `lib/trip-auth-store.ts` returns a sanitized DB-backed user or null. Protected data/routes must call it server-side; hiding controls does not grant or enforce permission. Existing editor JSON validation should use `tripRequestOrigin` for its public proxy Origin comparison. The API factory and actual D1 SQL adapter are independently injectable for public-handler tests.

## Passwords and sessions

Passwords use native `node:crypto` scrypt with N32768,r8,p3, a fresh16byte random salt and a32byte derived key. The serialized format fixes these costs and rejects malformed/unknown hashes. Constant-time comparison verifies the derived key. One native hash is allowed in flight per isolate; additional simultaneous attempts receive a bounded busy response instead of growing native memory or an unbounded queue. No password, raw session token, hash or provider diagnostic is returned in JSON.

[Cloudflare's node:crypto documentation](https://developers.cloudflare.com/workers/runtime-apis/nodejs/crypto/) lists scrypt as supported with Node compatibility. [OWASP's password storage guidance](https://cheatsheetseries.owasp.org/cheatsheets/Password_Storage_Cheat_Sheet.html#scrypt) includes N2^15,r8,p3 as a minimum configuration with approximately32MiB memory. [Node's crypto API](https://nodejs.org/api/crypto.html#cryptoscryptpassword-salt-keylen-options-callback) defines the options and asynchronous callback. The current project's compatibility flags already support this; no package was added. An actual Miniflare/Workerd check using the project's2026-05-15 compatibility date and nodejs_compat returned32derivedbytes in109ms.

Session tokens contain32randombytes/64lowercasehexcharacters. Only their SHA256 hashes are stored; sessions expire after14days, are revoked on logout/relogin, and each user retains at most10active sessions. The cookie is `ktravel_session`, HttpOnly, SameSite=Lax, Max-Age1209600, Path=/ktravel and Secure publicly; local HTTP uses Path=/. Duplicate/malformed cookies are rejected. A session ID conveys no client-controlled role or name; every read joins the current user row.

Persistent hashed throttle buckets bound login to10attempts/name/15minutes,60/client/15minutes and120global/minute; name lookup has120/client/5minutes and600global/minute. The current proxy does not forward IP identity, so its users share the client bucket. This is intentionally suitable for the small private trip group, not a claim of distributed per-IP enforcement. Expired buckets and sessions are pruned. Favorite writes are limited to120/member/minute. Failed/rate-limited/provider data never expose credentials.

## Name-based administrators and first password setup

The owner explicitly changed the initial-password behavior: Shawn and Sun choose their passwords in the same browser flow rather than receiving generated credentials. Roles come only from normalized server-side names; client-supplied role/ID fields remain rejected. The schema restricts admin rows to the reserved normalized names and prevents those names from becoming member rows.

For an existing Shawn/Sun administrator with `password_hash=''`, lookup reports exists:false. Submission hashes the chosen nonempty password and uses an atomic conditional update matching account ID, normalized reserved name, admin role and the still-empty hash. This preserves account IDs, favorites and creation metadata. Only one concurrent claim can succeed. After setup, submissions verify the existing hash; a stale setup cannot overwrite it. If the reserved account is entirely absent, registration creates it with the same name-derived admin role.

The local preparation script now only creates missing reserved records with empty hashes:

```sh
node --experimental-strip-types scripts/provision-trip-admins.mjs \
  --database .wrangler/state/v3/d1/miniflare-D1DatabaseObject/faaf2b0445ab934c3aac48ddf0cdfade8f9bac050be98993748742cdd2cb05fb.sqlite
```

It preserves every existing hash and account ID, does not generate a password and does not create credential files. Re-running it does not reset accounts. Any requested live reset must separately target only the intended account hashes and revoke those accounts’ sessions while preserving their IDs/favorites; the parent deployment task owns that operation. The backend change/tests do not mutate real accounts or prior private credential files.

This requested name-based setup lets the first password submitted for an unconfigured Shawn/Sun name establish that administrator account; it does not prove a real-world identity. Password recovery and external identity verification remain outside this flow.

## Verification

Nine focused handler/store/provisioning tests use the real SQLite migration/adapter: one-character and3000-character registration/login, empty/non-string and oversized-body rejection, registration and normalized login, wrong-password rejection, logout/expiry, cookie scope/duplicate rejection, isolated persistent favorites and visitor denial, cross-origin/unsupported-field/oversized rejection, name-derived administrator roles and rejected client role fields and throttle recovery. An empty-administrator handler test verifies first setup, returning/wrong-password login and preservation of account ID/favorites. Concurrent store claims have exactly one winner and cannot alter member passwords. A real provisioning subprocess verifies empty reserved records, no credential files and idempotent preservation of configured passwords/IDs. Password hashes/session hashes at rest and schema constraints are checked. No real project DB was altered by these tests.

The parent task verifies browser interaction, proxy forwarding, editor/directions enforcement and public deployment. These tests do not prove email identity, forgotten-password recovery, physically secure hosting, edge-platform CPU entitlement or unrestricted public signup suitability.
