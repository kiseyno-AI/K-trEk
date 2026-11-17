# Accounts, favorites and card readability — 2026-11-16

## Scope and constraints

Name-first membership with a password on new registration or return, explicit visitor mode, reserved Shawn/Sun admin roles with owner-chosen first passwords, authenticated DB favorites and existing complete card editor. Existing votes remain account-scoped browser drafts; group aggregation/password recovery are outside this request. Passwords are salted hashes, sessions are HttpOnly cookies and sensitive values never enter source or build output. Admin initial credentials stay outside the repo in a0600local file.

Retain the existing globe/quality/light counts. First cards wait until intro, Korea arrival and a login/visitor decision. Reuse finite card motion and the existing drawer for separate favorites/vote lists. Fix title line-box clipping without removing actual text.

## Before performance sample

Public initial flight,1280×720,DPR1,no CPU/network throttle,9.5sread-onlyrAFsample withtrace:269active intervals,p50=16.7ms,p95=49.9ms,max83.4ms,21intervals>33.4ms. No observed longtask>=50ms. Submission0.20msdid not establish frame pacing. One canvas,10buffers/fiveprograms/fourtextures. Trace LCP540ms,CLS0. Default MCP trace worked but direct local trace saving was unavailable because its workspace roots differ.

## Ownership and gates

No new repeating UI owner; form stages use finite CSS motion and reduced-motion fallback. Sessions/favorites requests abort on disposal/account changes; visitors cause no directions requests. Existing renderer owns and releases resize/visibility resources. DB changes are additive and backed up before migration. Auth, role, visitor, admin CRUD, favorite persistence, layout and bounded desktop performance were verified below.


## Runtime evidence before the final candidate import

Migration0005applied after owner-only SQLite backup at`.wrangler/backups/before-accounts-2026-11.sqlite`. ReservedShawn/Sunaccounts were locally provisioned; initial passwords live only in`/Users/shawn/.config/ktravel/admin-login.txt`(0600), DBpasswords are salted scrypt. The account DB/WAL/backups are owner-only. No real host credential appears in source or tool output.

ActualHTTP tests verified member creation/login, storedfavorites, member read/create/update denial403, visitorfavorite/directions denial401, and admin hidden-card create/update/read with bothhostreviewfields saved. Temporary cards were removed. Publicproxy tests then verifiedSecure/HttpOnly/SameSite cookie scope, persistedfavorite read/write, member/visitor gates, Sunadminread/create/update and logout revocation. The local development bypass was removed; local/hosted editor access both require the DBadminrole.

VisibleUIverified first-name-only screen, new-name password step(without creating that preview account), existing-name password login, DBfavorite1→0→1, separatefavorites drawer and visitorcards without anyheart/vote/travelactions. The initialcard reveal follows access decision and cameraarrival. Full title/summary/action boxes fit1280×720and390×844; compact320×568long-title and pending-photo cards also fit exactly after finalshortlayout adjustments, with no internal card overflow or document scrolling.

Additional30candidatephotos were visually checked against their named subjects:29controlled local WebPs, with WIIRPhiladelphia retained as a real card but its exactoperator menu photo pending.


## Latest requested login copy and visitor behavior

The brand reads`K-trEk, without Shawn & Sun`, with the attached`out`letters rendered smaller. The first-name greeting is“Hi, Cluster E! Thanks for your interest in Korea. What's your name?” A registered name explicitly saysWelcomeandasksforitsoriginalpassword; a new name saysNicetomeetyouandexplicitlyaskstosetapasswordtocreateanaccount. Name lookup itself never creates an account.

The owner explicitly removed password character-count limits: any nonempty password, including one character, is accepted. Required input and the4KBJSON request budget remain; existing admin credentials, scrypt costs, salts, role checks, sessions and throttling are unchanged. A public-handler regression covers one- and3,000-characterregistration/login. Visitorcards retain the ticking countdown but no vote/heart/routecontrols; selecting a card openslogin.


## Final application checks

The public release passed18CSS/JS HTTP/MIME checks. All113published photo URLs returned200with image MIME and an exact SHA-256 match to their controlled local files. Database counts are117total records,114published,32Food and3Nightlife. WIIRPhiladelphia is the sole pending photograph. A compiled-client/public scan covered59text assets and foundzeroactual API/initial-admin secret values. Full application tests161/161passed before the final owner-requested admin-setup adjustment; final gate results follow below.

Public existing-name lookup displayedWelcomeand the original-password instruction; new-name lookup displayedNicetomeetyouwith explicitSetyourpassword/Createaccount wording. Public HTTP registration/login with a one-character password passed, including secure cookie scope. Visitor countdown labels advanced1447:04:29→1447:04:22with no heart/vote/routecontrols; clicking the WIIRcard opened the name greeting. The attachedbrand textContent is exactlyK-trEk, without Shawn & Sun. Favorites persisted across local/public login and listedSamwonGardenandNamiIsland; actual Nami road geometry and endpoints rendered separately from the detail panel.

The owner then explicitly requested removal of both pre-generated host passwords and initial password setup byShawn/Sun. The previous private credential file is superseded; the final implementation keeps host identities/favorites but clears only their password hashes and sessions once, lets each host choose their own password, and derives the adminrole from the normalized reserved name. After setup, subsequent access requires that password.


## Changed surfaces and simplifications

- Login/session/favorites: `app/trip-login.tsx`, `app/activity-explorer.tsx`, `app/api/session/**`, `app/api/favorites/route.ts`, `lib/trip-auth.ts`, `lib/trip-auth-store.ts`, `lib/trip-admin.ts`, `db/migrations/0005_trip_accounts.sql`; the existing admin editor remains the single card-editing surface.
- Presentation: `app/globals.css`, `app/layout.tsx`, `ui-components.json`; reuse one native two-stage form, the existing favorites/vote drawer, existing tokens and finite motion. Generated administrator passwords and the plaintext credential-file workflow were removed; no dependency added.
- Map: `app/planet-canvas.tsx`, `app/planet-shaders.ts`, `lib/planet-camera.ts`, `lib/planet-telemetry.ts`, `lib/trip-origin*.ts`, `public/trip/korea-regions.json`; one persistent scene and observer owner, unchanged light counts and DPR.
- Content: expanded candidate/photo manifests, importer,29localWebPs and `tests/expanded-candidates.test.mjs`; import is idempotent and preserves existing edits.
- Public proxy: the trip-only auth/cookie allowlist in the Observatory `server.mjs` and focused proxy tests; server roles remain authoritative.

Final application gate:168tests passed; lint, TypeScript, diff check and component registry passed(7families,43reviewed sources,67free patterns). Both local/public18CSS/JS assets passed on release. SQL is reviewed/tested directly: Graphify refreshed1224nodes/2636edges but lacks its optionalSQLparser and skipsCSS/fonts/other unclassified files; local private/generated directories remain excluded. No graph or credential state is published. See the performance report for measured desktop limits and the remaining physical-phone/true-background measurement gaps.


## Owner-requested host reset completed

After the final release passed its local/public asset gates, the live SQLite DB was backed up privately to `.wrangler/backups/before-host-password-reset-2026-11.sqlite`(0600). One transaction cleared exactly the Shawn/Sun password hashes, revoked their old sessions and reset only their name-specific sign-in attempt limits. Account IDs, roles and favorites were preserved. Both rows remainedadminwithzero-lengthpassword hashes. The obsolete `/Users/shawn/.config/ktravel/admin-login.txt` plaintext file was removed. Public POSTname lookup returned`{name:"Shawn",exists:false}`and`{name:"Sun",exists:false}`. No new real-host password was chosen or submitted by QA. Each owner now sets their own password through the page; the atomic setup test proves a later/stale setup cannot replace it.

Two exact QA-only member accounts and their own sessions/favorites were deleted after logout; no participant/host account was removed.


Visible public host QA completed: enteringShawn opened“Nice to meet you, Shawn.” with“This is your administrator account. Please set your own password below.”, a blankSetyourpasswordfield andCreateaccountaction. QA did not submit a host password. Both public name lookups were unset; Sun shares the same tested host flow. Final greeting screenshot:`.impeccable/review/ktravel-accounts-final.webp`. Temporary viewport/reduced-motion overrides were reset. Final API-secret scan58files/zerohits; the removed initial credentials cannot be read from their former file.
