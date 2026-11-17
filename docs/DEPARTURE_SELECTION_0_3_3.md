# Selectable departures — local v0.3.3

Expanded member cards use the existing route panel with a labeled native44px Departure select. The selected departure is shared by road, bus, subway and mixed estimates, departure marker, labels and continuous camera fitting. Another card retains the selection for the page visit; a reload uses the configured default again. Visitors still require membership to open details and request routes.

## Verified meeting points

Kakao Local keyword search returned these station pins on2026-11-17. WGS84 values are rounded to seven decimal places. They identify station meeting points rather than a promised car pickup entrance. Jongno1-ga is an area; Jonggak Station at54Jongno1-ga is its named meeting point. Sinchon means the subway Line2station, not the Gyeongui–Jungang station.

| Query ID | English label | Longitude, latitude | Source |
| --- | --- | --- | --- |
| `default` | Configured departure | Existing server configuration, Seoul Station by default | `lib/trip-origin-store.ts` |
| `seoul-station` | Seoul Station |126.9707793,37.5545547| Existing verified main-line terminal |
| `jongno-1-ga` | Jongno 1-ga |126.9831508,37.5702280|[Jonggak Line1](https://place.map.kakao.com/21160613)|
| `sinchon-station` | Sinchon Station |126.9369808,37.5551982|[Sinchon Line2](https://place.map.kakao.com/21160531)|
| `gangnam-station` | Gangnam Station |127.0280014,37.4980863|[Gangnam Line2](https://place.map.kakao.com/21160803)|
| `yangjae-station` | Yangjae Station |127.0341641,37.4845768|[Yangjae Line3](https://place.map.kakao.com/21160815)|

Lookup used the existing server REST key with the [official Kakao Local keyword endpoint](https://developers.kakao.com/docs/ko/local/dev-guide#search-by-keyword). No key, user location or credentials are placed in the shared presets, browser or this report.

## Request and resource ownership

The existing directions effect owns one AbortController and one15s client deadline. Origin changes abort/release that request, discard its response, clear route geometry/totals immediately and reset travel mode to Drive. Results must match both activity and selected origin; late successes and late errors cannot overwrite a newer selection. Countdown ticks preserve stable origin objects and do not refetch.

The server accepts only listed origin IDs; omitted/`default` preserves validated server configuration. Invalid values return400 before provider work. Same-origin simultaneous viewers share in-flight work; different coordinates/names have distinct keys. Completed responses remain uncached and are not saved to D1. Existing member authentication,20provider starts/minute per isolate, concurrency and8s upstream deadline remain unchanged.

No new animation loop, observer, listener, texture, buffer or timer owner was added. The single existing scene updates markers/routes and flies from its current displayed camera. Existing background/viewport pause, reduced-motion behavior and teardown remain with PlanetCanvas. Target: one retained canvas, unchanged4textures/10buffers/5programs/10shaders, finite flights and no countdown-triggered route requests. Performance evidence here concerns renderer CPU submission snapshots, not GPU time or whole-machine CPU.

## Verification

The first preset resolver test failed before implementation. The real explorer callback/effect regression also failed with no Departure control before the UI change. It now proves immediate stale-total removal, abort on each change, latest-response isolation (including late errors), no countdown refetch and selection retention across card return. Endpoint tests prove driving/transit origin agreement, default/custom preservation, invalid-ID rejection and in-flight isolation/cancellation. Live browser and final gate evidence follows in the integration report below.

This change is local only. No public build/deploy, public worker restart, public database change or new dependency was performed.

## Final integration evidence

- `npm test`:287passed,0failed/skipped, including34focused origin/endpoint/explorer regressions. `npm run lint`, `npx tsc --noEmit`, `npm run ui:check` and `git diff --check` pass. A separate read-only integration review found no actionable issue.
- Local IAB Chromium at1280×720selected all five departures and returned actual road/transit estimates. Samwon Garden observations during this check were42min from Seoul Station,34–35min from Jongno1-ga,43min from Sinchon,14min from Gangnam and21min from Yangjae. These are transient query-time estimates, not stored planning values. Taxi estimates and subway/bus alternatives also changed.
- Arrow-key/Enter selection changed Sinchon to Gangnam. At390×844the native select, loading state and returned estimates remained visible without horizontal overflow (`body.scrollWidth=390`) or whole-page vertical scroll (`scrollTop=0`). A subsequent Jongno1-ga→Hanilkwan card visit kept the chosen departure and fetched its own31min road estimate. Subway selection used the new origin and actual subway/walk geometry.
- One persistent canvas retained4textures/10buffers/5programs/10shaders through departure changes, mobile/desktop resize, travel mode change and detail/back/another-card navigation. Its draw counter continued from1,787to11,083without a scene remount. Sampled synchronous draw submission was0.5–0.6ms before implementation and0.1–0.4ms during/after this QA; these samples do **not** establish improved frame pacing, GPU cost or whole-machine CPU. Finite camera flights settled to `phase=detail`, `animating=false` with the existing12fpsambient owner.
- Renderer ownership/pause/reduced-motion code was unchanged and reviewed. The background-tab probe still reported `document.hidden=false` in this IAB environment, so it did not exercise a true hidden-document pause. Physical-phone GPU/battery, OS reduced motion, native backgrounding and long-session heap were not remeasured; no performance improvement is claimed for this selector feature.
- Local Graphify refreshed to1,406nodes/3,134edges. Its134unsupported files (including CSS/assets), missing SQL parser for7files and test-file symbol gap remain. Direct source review and executable checks cover the changed paths. `resolveTripOrigin` callers are the explorer and directions handler.
- Final [desktop evidence](../.impeccable/review/departures-v0.3.3.jpg); visual verdict96/100, preserving the existing trip styling. No browser warning/error logs were observed during the final check.

Changed implementation: `lib/trip-origin.ts` (shared presets/resolver), `lib/kakao-directions.ts` (allowlisted request origin), `app/activity-explorer.tsx` (selection/cancellation/display), `app/globals.css` (native control). Focused coverage: `tests/trip-origin.test.mjs`, `tests/kakao-directions.test.mjs`, `tests/trip-voice-ownership.test.mjs`. Supporting updates: version files, `PRODUCT.md`, directions guide, component registry/report and this evidence. Existing scene and request owners were reused; no geocoder service, new renderer or persistence layer was added.
