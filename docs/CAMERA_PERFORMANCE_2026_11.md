# Camera frame pacing — 2026-11-16

## Reproduction and baseline

The user reported stutter during zoom rather than a slow API response. Prior `canvas.dataset.drawMs` values around0.2ms measure synchronous command submission only; they do not establish frame pacing, paint, compositor or GPU cost.

The parent captured the deployed initial orbit-to-Korea flight at1280×720, DPR1, no CPU/network throttling, with a browser performance trace and a bounded9500msread-only RAF sampler. Active-flight269samples:p50=16.7ms,p95=49.9ms,max=83.4ms,21intervals>33.4ms. Across319total intervals,p95was also49.9ms. There were no main-thread long tasks>=50ms. The trace summary reported LCP540ms and CLS0; no forced-layout insight was emitted. Raw trace-file export was unavailable because the MCP file root rejected the target, so this is a bounded sample and trace-summary baseline, not a full CPU/GPU attribution.

## Source finding and change

`PlanetCanvas` previously read each label's clientWidth/clientHeight after writing the previous label's opacity/transform, and repeatedly read canvas dimensions between those mutations. It also projected and rewrote labels while the country view hid them. The source alternation can force repeated style/layout work, but the trace did not quantify that specific cause.

The existing renderer now caches the viewport and label dimensions through one ResizeObserver and an existing-view-update measurement callback. All layout boxes are read together on initial mount, observed size/font changes, window resize, new geography labels and destination-title changes. Camera frames use cached numeric geometry and never read clientWidth/clientHeight. Disabled labels return early; identical opacity/transform values are left alone. No point count, shader, texture, DPR, geographic precision, route mesh or camera interpolation was reduced.

The endpoint buffer is uploaded on selection/update rather than RAF and is left unchanged: it was not the per-frame hot path and no evidence justified extra caching there.

## Ownership

The renderer owns one added ResizeObserver. It observes the canvas and current label nodes, unobserves removed labels, ignores callbacks after disposal, and disconnects/clears its caches on renderer teardown. Existing IntersectionObserver, visibility pausing, reduced-motion settling, camera RAF and12fpsambient timer retain their ownership. Measurement callbacks do not create another RAF or recurring timer. Opacity/transform changes do not resize the observed labels, avoiding a feedback loop. Font/title changes continue to update real label widths and collision avoidance.

## Verification and limits

43focused camera, road-ribbon and light-style tests pass; prototype smoke, scoped lint, TypeScript and diff checks pass. No new dependency or GPU resource. This is a performance-only renderer change; UI registry fingerprints and final visual/public release gates belong to the parent integration.

After-release comparison must repeat the same1280×720DPR1, no-throttle orbit-to-Korea trace/9500msRAF sample. Also verify label text/viewport remeasurement, route selection and repeated detail/back resource counts, reduced motion and hidden/offscreen pausing. Physical phone GPU/battery and long-session heap remain unmeasured. Record actual after-values below; do not claim all stutter resolved from the source change alone.


## Bounded second pass after actual frame-pacing QA

The first deployed cache change did not demonstrate an improvement: parent same1280×720DPR1after sample had223active intervals,p50=16.7ms,p95=50.1ms,max=83.4ms,30intervals>33.4ms. The earlier baseline had269active intervals,p95=49.9msand21>33.4ms. This is not a measured win. Parent reported hardwareANGLEMetalAppleM4 and setup long tasks51/62/290msbefore the active flight; no inference that the entire remaining issue was forced layout is justified.

A scoped source/caller audit found no product UI reading the canvas diagnostics. The renderer had been mutating about25diagnostic DOM attributes every camera frame, including invariant values. A new lazy `sceneDiagnostics` publisher now samples these numeric diagnostics every250ms, skips identical values, and forces selected-route changes and the final camera frame. The internal draw counter still advances everydraw, but DOM telemetry is a sampled view; short draw-count comparisons now have250msquantization. Essential phase/animating/renderer states remain immediate. Two new public-helper tests prove lazy sampling, duplicate suppression and forced final/state publication. The publisher adds no timer/RAF/listener.

The exact per-point shimmer sine was also moved from the light fragment shader to its geographic vertex shader. A GL_POINT has one vertex value shared by its fragments, so this removes repeated per-fragment trigonometry without reducing sprite size/count, varying brightness, glow shape, source precision, DPR or camera interpolation. Ring markers retain shimmer1.0. Shader visual/compile checks and a same-window warm parent frame-pacing/GPU comparison are required after release; do not describe this source optimization as a measured GPU improvement before those results.

Skipping transparent focus0passes was considered and omitted: the existing orbit has no active camera RAF, so those calls are mostly startup-only and do not explain the reported active-flight jitter. Endpoint uploads remain selection-only.


## Final public measurement

After the lazy diagnostics and equivalent vertex-shimmer change, the same public initial flight was measured at1280×720, DPR1, no CPU/network throttle. A warm9500msRAFsample without tracing captured338active intervals:p50/p95=16.7ms,max16.8ms,zero>33.4ms;390total sampled intervals showed the same bounds. A second9500mssample with the same trace mode used for the original baseline captured308active intervals:p50/p95=16.7ms,max16.8ms,zero>33.4ms. No main-thread long task>=50ms was observed in either final window. The trace reported LCP562ms and CLS0.00. The baseline active-flight p95was49.9ms, so the final bounded desktop run demonstrates improved pacing; it is not a guarantee for cold devices, all sessions or phones.

Compiled shaders rendered visibly in public/local country and detail views. Both12492country and12000Seoul light counts, screen DPR and geography precision remain. Actual scenes retained one canvas,10buffers,fiveprograms,fourtextures after country/detail/return navigation;16province/230outside-Seoul city areas loaded. Reduced-motion emulation made twinkling=false, animating=false and routeFlowing=false; the draw counter remained exactly3605across a1400mssample, with all resources retained once. Diagnostic counters are250mssampled; active rAF values came from browser performance timestamps, not draw-submit timing.

Visibility and intersection paths stop ambient work/cancel and resume camera ownership; teardown aborts fetches, disconnects both observers, removes listeners and deletes every GPU resource. Source ownership was reviewed. The in-app browser reports both background tabs visible, so a true hidden-tab runtime measurement was not available on that surface. Physical phone GPU/battery and long-session retained heap remain unmeasured. The only observed public-console error was the surrounding Cloudflare analytics beacon blocked by the host CSP; application rendering and auth did not fail.
