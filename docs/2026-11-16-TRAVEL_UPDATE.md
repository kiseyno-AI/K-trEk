# Travel update — 2026-11-16

Published at https://shawnai.win/ktravel.

## Behavior

- Noto Sans KR is self-hosted for the public site and admin, with its OFL license. Categories share the heading's center; mobile controls fit at 390×844 and 320×568.
- The vote draft accepts 20 activities and prevents a 21st. Its one-second numeric countdown ends on January 15, 2027 at 23:59:59 America/New_York (`2027-01-16T04:59:59Z`). Existing browser-only demo vote storage remains unchanged.
- Routes use a rounded 4.4 CSS pixel coral ribbon with ivory highlights moving from Seoul Station to the destination. The existing geographic camera and animation owner are reused; reduced motion keeps a solid route.
- The blue travel list shows driving distance/time, estimated taxi fare, positive tolls and available subway, bus and mixed options. Distances include miles. Missing provider fares remain unavailable rather than guessed. The visible Kakao Mobility label is removed; the route source link remains.
- Food cards omit suggested planning stay and notes. Identical booking/group instructions appear once. Sources contain links and required linked photo attribution without extra prose.
- Five researched food cards were added: Myeongdong Kyoja, Hadongkwan, Tosokchon Samgyetang, Woo Lae Oak and Gwanghwamun Mijin. There are now 75 published cards, including 15 food cards. All 73 preexisting database rows are unchanged; three illustrative samples remain unpublished.
- The unstyled public-page failure was reproduced and fixed. `npm run release:public` coordinates the build and Wrangler asset manifest, retains one previous generation of hashed assets and rolls back a failed release.

## Main changed files

- `app/activity-explorer.tsx`, `app/globals.css`, `app/layout.tsx` and admin styles: presentation, font, voting and travel list.
- `app/planet-canvas.tsx`, `app/planet-shaders.ts`, `lib/route-ribbon.ts`: geographic route ribbon and flow.
- `lib/kakao-directions.ts`, `lib/driving-route.ts`: taxi and transit normalization with bounded provider requests.
- `lib/activity-presentation.ts`, `lib/vote-planning.ts`: pure helpers covered by focused tests.
- `data/extra-food-2026-11.json`, `data/extra-food-photos-2026-11.json`, `scripts/import-extra-food.mjs`, `public/trip/photos/food-extra-*.webp`: additive food import and images.
- `scripts/release-public.mjs`, `scripts/check-public-assets.mjs`, `package.json`: public release and HTTP asset checks.
- `public/trip/fonts/`, `ui-components.json`, `docs/UI_COMPONENTS.md` and focused tests document licensing and verification.

## Verification

- 115 tests passed, including the Kakao adapter, route geometry, facts, voting clock, non-destructive food import and public release checks. Lint, TypeScript, production build and the registry gate passed (4 component families, 25 reviewed sources).
- Public and loopback checks fetched all 17 referenced CSS/JS assets with HTTP 200 and correct content types after two actual releases. Font CSS, Latin WOFF2 and new food images also returned 200. Previous hashed CSS/JS remained available across the release.
- Actual public Samwon detail displayed drive, taxi, subway, bus and mixed options. Its five travel rows had no label/value overlaps at 390×844; the document stayed exactly viewport-sized. Estimates vary with traffic and schedules.
- A real 20-selection draft disabled the 21st choice. Removing one restored capacity. No test vote was submitted. The countdown decreased by two seconds over 2.1 seconds.
- At 1100×820, categories measured center 550, exactly the viewport center. At 390×844 and 320×568, Select and Review vote remained visible without document scrolling.
- Native desktop route performance sampled 14 draws/1.132 s with 0.50 ms maximum synchronous submission, versus 14/1.128 s and 0.30 ms before the ribbon. A final public detail sample produced 13 draws/1.107 s with advancing flow phase and constant one canvas, 10 buffers, 5 programs, 10 shaders and 4 textures. Mobile reduced motion produced zero draws/1.103 s while the voting clock continued.
- Public admin and write surfaces remained blocked. The actual server secret was absent from all 341 final build artifacts; no key is stored in frontend source or assets.
- Graphify refreshed locally to 1,063 nodes/2,220 edges. CSS/font formats are unsupported and the SQL parser dependency is absent; direct source review, SQLite tests and rendered checks cover these gaps.

## Limits

KakaoMap was enabled after the owner's free-tier approval. The console assigned Korea Travel the daily free quota; payment and paid API settings were not enabled. Provider policy fixes the first-app free-quota allocation. Requests remain bounded locally, but the provider's quota applies across app usage.

Live calls sampled selected destinations rather than all 75 cards. Times/fares are estimates; absent exact-option fares are not inferred. Two new photos are licensed Commons files; three are official reference images whose reuse permission remains unverified. See `EXTRA_FOOD_2026_11.md` for provenance and booking/address uncertainty.

CPU numbers above measure synchronous renderer submission, not GPU or whole-process CPU. Actual hidden/offscreen timing, mobile hardware GPU performance and long-session heap retention were not measured. Visibility pausing and cleanup were source-reviewed; the in-app host did not report background tabs as hidden.

No dependency, additional animation loop or database table was introduced. Existing route buffers, camera projection, visibility controls, activity table and photo importer were reused.
