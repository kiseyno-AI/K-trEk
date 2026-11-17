# K-trEk v0.2.0 — local verification

Implemented locally on November 16, 2026. Main preview: http://localhost:3000. No public build, deployment, production restart or production DB migration was performed.

## Behavior

- Shawn and Sun can edit both hosts' optional 1–5 stars and comments inside an expanded activity, using one Save comments action. Members retain read-only reviews. Saving updates only the four review columns and the activity timestamp.
- Every signed-in member has a Report to Shawn textarea immediately above Sign out. Reports are stored in D1. Shawn receives an automatic unread-report dialog after signing in, with explicit read/dismiss actions; dismissal preserves unread state. Reports and Members controls are Shawn-only on both client and server.
- Members lists names, registration dates, categories clicked, saved hearts, draft choices and submitted choices separately. These are preference snapshots, not a new aggregate election system or browsing history.
- Category navigation has native List/Grid buttons on its right. Grid cards use a square photo on the left and a low, wide text/action area. Mobile list cards use the same layout. Grid scrolling stays inside the card pane; the document stays fixed. The list retains its existing one-card-per-gesture wheel behavior.
- Grid cards override the old carousel distance-based pointer suppression. Later rows can open Details, and returning from a detail restores the grid's prior scroll offset. Category/view changes reset the pane to its beginning.
- A v0.2.0 footer derives from package.json.

## Changed ownership

Parent integration: app/activity-explorer.tsx, app/globals.css, package.json, package-lock.json. New UI owners: app/host-reviews.tsx and its CSS module; app/trip-community.tsx and its CSS module. Existing activity mapping, camera animation, favorite persistence, session authorization and native dialogs are reused. No dependencies or extra frame loops were added.

New server/client behavior lives in lib/trip-community.ts, lib/trip-community-store.ts, lib/trip-community-client.ts; app/api/preferences/route.ts, app/api/reports/route.ts, app/api/members/route.ts and app/api/activities/[id]/reviews/route.ts. db/migrations/0006_trip_community.sql adds only member preference and report tables. Focused coverage: tests/trip-community.test.mjs, tests/trip-community-client.test.mjs and tests/inline-host-reviews.test.mjs.

vite.config.ts and scripts/db-setup.mjs isolate development persistence in .wrangler/local-state, rather than the public worker's .wrangler/state. A KTRAVEL_DEV_STATE_PATH override also isolates QA state/cache/inspector ownership. Registry ownership and reviewed hashes are in ui-components.json and generated docs/UI_COMPONENTS.md.

## Evidence

- npm test: 213 passed, 0 failed/skipped; includes prototype smoke and photo manifest checks. Full TypeScript, Oxlint, diff checks and UI registry pass (9 families, 57 reviewed sources).
- Real HTTP handlers plus SQLite tests cover identity isolation, Shawn/Sun/member permissions, exact review updates, malformed/oversized input, failed reads, serialized preference writes, logout flushing, request cancellation and limits. A new regression proves logout waits for a pending retry GET before persisting the final preference.
- Actual browser interactions on a private anonymized QA DB: admin review save and reload showed Shawn=4, Sun=5 and both saved comments; Shawn's automatic report popup, mark-read persistence and unread replay; member report submission; member hearts/votes restored; new category persisted after logout; Members showed the expected names/categories/hearts/draft/submitted choices. Escape closed the native dialog and restored trigger focus.
- Real HTTP: Casey and Sun receive 403 for Members/report inbox; Shawn receives 200. Member report POST returns 201. Actual test reports/reviews/accounts were created only in the private QA fixture, never the main or public DB.
- Desktop square photos are 144px, compact mobile photos/cards are 128px high. At 390×844 the grid card is 350×128; at 320×568 it is 280×128 and Details clears its bottom edge. Both document sizes equal their viewport. The compact Shawn header fits all action buttons on one row below the wordmark, including the existing local-only voice control.
- A later-row Jongmyo Details click and a Suwon Details click both succeeded. The 390px grid returned at scrollTop 1713, matching its offset after the browser had brought the clicked action into view. Two repeated detail/return cycles kept one canvas, 10 buffers, 5 programs, 10 shaders and 4 textures.
- Native desktop Chrome and the in-app browser rendered the UI without captured console errors. Screenshots: .impeccable/review/community-grid-desktop.jpg and community-grid-mobile.jpg. Final visual verdict: 95/pass, compared with the requested compact square-left-photo layout and existing visual system.
- A temporary published development probe was visible at localhost:3000 and absent from the public API, then removed. Final public DB still has neither community table; the main development DB has both and no QA Casey account. Main dev server remains running. The temporary QA server, source snapshots and anonymized QA database were stopped/removed after verification; screenshot evidence remains.

## Motion and measurement limits

Existing renderer baseline and lifecycle plan remain in docs/MOTION_PERFORMANCE.md. Grid entry/exit reuses the finite card animation owner, with only viewport-intersecting cards animated. Its existing visibility pause, reduced-motion finish and cancellation remain unchanged. List wheel cancellation is bound only while list mode is mounted and disposed when switching to the grid. Grid uses native pane scrolling and native lazy image loading; at 1920×873 the all-114-card grid had 113 photo nodes and 55 loaded images. The DOM is bounded by the published activity list, rather than a new cache or virtualizer.

Post-integration sampled synchronous WebGL submission was 0.00–0.20ms at rest and 0.30ms in the observed active detail flight; the stable GPU owner counts above match the earlier baseline. These samples measure renderer submission, not whole-page CPU, GPU frame completion, memory or sustained mobile performance. Community requests have finite 8-second deadlines, review saves 12 seconds; preferences own one 300ms debounce and at most one active write. Disposal aborts requests/timers; dialogs/report fields add no polling or animation loop. Existing startup/disposal tests and new request-disposal tests pass.

Physical Android/iOS testing, a new long-session heap/CPU trace, and a native hidden-tab/reduced-motion run were not performed in this pass. Browser read helpers activate the observed tab, so they cannot establish a hidden-tab performance result; no such result is claimed. Production compilation was intentionally skipped because this checkout's dist serves the public site. Local SSR/client compilation and all source gates passed. Graphify refreshed after source edits; CSS and SQL extraction remain incomplete (unsupported CSS and missing tree_sitter_sql), and those sources were checked directly.
