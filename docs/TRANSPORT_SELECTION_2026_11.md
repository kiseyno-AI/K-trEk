# Transport selection and card departures — 2026-11-16

## Scope and baseline

Extend the existing directions handler/model, route ribbon renderer and canonical activity explorer. Keep live credentials server-only, the current camera, provider limits, votes/favorites and all data/editor fields. No dependency or second animation/render owner.

Baseline on the public1280×720 country view:13draws/1.125s, maximum sampled synchronous submission0.30ms, one canvas,10buffers/fiveprograms/fourtextures. The count badge measured35pxagainst34.97pxtext, with zero horizontal padding. Category selection replaced cards immediately in phase ready with no translation.

## Ownership and budget

The existing cardAnimations owner handles finite entrance820ms/95msstagger and departure460ms/55msstagger. Detail dismissal finishes its rightward departure before returning the map; category changes retain old cards until departure ends, then reveal the latest requested filter. Existing visibility pause/resume, reduced-motion completion and cleanup cancellation are reused. Route selection reuses already-fetched results; one existing route buffer is uploaded on selection changes, with at most four mode batches. No new RAF, interval, observer, texture, program or GPU buffer is introduced. Target existing12fpsambientidle and stable resource counts; active camera uses its existing finiteRAF.

## Verification

130 tests pass, including two new provider-handler regressions, selected-route geometry, disconnected/batched legs and rightward card flight checks. Lint, TypeScript, UI registry, production build and public CSS/JS gates pass. The source detector reports zero failures; its one existing press-easing advisory is unrelated. Graphify refreshed locally to1,100nodes/2,331edges; CSS/fonts and the unavailable SQL parser remain direct-review/test-covered index gaps.

Local visible UI QA selected Drive, Bus, Subway and mixed routes, including keyboard Space on Drive. The map reported drive, bus/walk, subway/walk and bus/walk/subway respectively, with distinct actual geometry. Drive includes its taxi estimate. Desktop and390/320mobile route rows remain within their panel widths:274/204pxwithout horizontal overflow. The390pxbadge has26.23pxtext inside44.23pxbackground, including9pxpadding per side.

Back sampled the moving detail panel atx720,772,890and1176before unmounting into camera-return phase. Rapid Nature→Shopping input during entrance kept Nature's continuous movement throughx645,459,451and450, then departed throughx470,570,893and1323; only after departure did the latest Shopping cards enter. Current entrances/morphs finish before queued departures; no shared-element reset is used.

The public release completed with matching server/assets;18CSS/JSassets passed on both4330andshawnai.win. Final public/reduced-motion/performance evidence follows below.


## Final public evidence

The deployed controls selected Bus240points, Subway318points, Drive183points and mixed218points; canvas mode and legend matched each pressed button. Mixed showed bus/walk/subway colors. All selections retained one canvas,10buffers/fiveprograms/fourtextures. The settled mixed view sampled13draws/1.127s, maximum synchronous submission0.20ms, with zero temporary morph layers. Public country idle remained13draws/1.123s,0.40msmaximum versus13/1.125s,0.30msbaseline. These short samples do not establish GPU time or whole-process CPU.

Under actual reduced-motion emulation, the updated public country view produced0draws/1.122s and0runninganimations, with twinkling=false and the same resource counts. Public Back during the opening morph retained that morph, then sampled the final panel atx617,652,749,928and1261before entering camera-return. Temporary emulation/viewport overrides were reset. The public tab remains on the selected mixed route; the disposable local QA tab was closed.

The public badge now measures52.97pxagainst34.97pxtext. Compiled assets contain zero matches for configured secret values. The only inspected console error is the existing optional analytics beacon blocked by CSP. Physical-phone GPU/battery, long-session heap and real hidden/offscreen scheduling in the in-app host remain unmeasured; pause/finish/disposal guards were source-reviewed.

## Changed files and simplifications

`app/activity-explorer.tsx`, `app/globals.css`, `app/planet-canvas.tsx`, `app/planet-shaders.ts`, `lib/card-morph.ts`, `lib/route-ribbon.ts`, `lib/driving-route.ts`, `lib/kakao-directions.ts`, corresponding card/route/provider tests, `PRODUCT.md`, `ui-components.json` and its generated report.

The separate taxi/toll rows are removed. Existing response data, card animation owner, camera, shaders and route buffer are reused. No new dependency, provider call on mode selection, database migration or data edit.
