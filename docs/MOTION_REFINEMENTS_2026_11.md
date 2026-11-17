# Motion refinements — 2026-11-16

Published at https://shawnai.win/ktravel after the owner's instruction to try the reviewed effects.

## Delivered behavior

- Selecting a card carries its photo, cream surface and unscaled title/summary into the detail panel over 820 ms. The photo keeps its cover crop. Destination content appears only after both photo frames align; live detail paragraphs never scale.
- Moving text is clipped to the interpolated surface bounds, including short panels whose real heading is below the scroll viewport. Native DOMRect getter values are read explicitly rather than lost through object spread.
- The first main heading settles word by word (440 ms, 55 ms offsets). It does not replay on voting ticks, category changes or returning from detail. Reduced-motion visits and preference changes complete that entrance immediately.
- Enabled Favorite/Select icons squash slightly on a native press and settle on release. Disabled controls keep their existing behavior. This small, requested icon response intentionally uses an overshoot easing; the Impeccable detector reports it as an advisory, not an unresolved accidental style.
- The active card has a thin, finite warm gold edge sweep on hover or keyboard focus. This is a CSS adaptation of the reflective idea, not a copied metal shader.
- The deadline clock moves only changed numeric glyphs for 160 ms. It retains its semantic time, exact deadline and existing 1 Hz owner. Initial, inactive, hidden, length-changing and reduced-motion values remain immediately readable.

Noto Sans KR, the centered categories, twenty-choice limit, existing globe/camera/route, camera-before-cards return sequence and no whole-page scrolling are preserved. No database or activity data changed.

## Changed files and reuse

- `app/activity-explorer.tsx`: transient card presentation, first-heading completion and clock integration.
- `lib/card-morph.ts`: measured card/photo/text geometry, aligned crossfade and visible-surface clipping. Returns animations to the existing owner rather than starting another frame loop.
- `app/globals.css`: decorative layers, finite heading/edge effects, native icon press response and motion fallbacks.
- `app/animated-countdown.tsx`, `app/animated-countdown.module.css`: the one shared digit renderer; it receives the already-computed time and owns no clock.
- `tests/card-morph.test.mjs`, `tests/animated-countdown.test.mjs`: geometry/fallback/clipping and semantic time regression coverage.
- `ui-components.json`, `docs/UI_COMPONENTS.md`, `PRODUCT.md`: reviewed sources, callers, states and design context.

The whole-panel scale was removed. Existing card animation cancellation, visibility handling, map renderer and clock were reused. No dependency, shader, canvas, map API, perpetual timer or animation frame owner was added. Space UI patterns are recorded as analogues: Morphing Area, Liquid Metal Border, Like Button, Blur Reveal Text and Fluid Countdown; their upstream package code does not run here.

## Verification

- 120 tests passed, including test-first geometry and the short-panel/native-getter regression. Lint, TypeScript, production build and the registry gate passed: 5 families / 28 reviewed sources.
- The coordinated public release fetched all 18 referenced CSS/JS assets successfully on loopback and the public domain. All 344 final build files were scanned against the actual server secret with zero matches.
- Desktop intermediate frames showed unscaled live text (`transform: none`). Target opacity stayed zero while source/destination photo bounds differed, then crossfaded only at exact matching bounds. Temporary layers disappeared after the flight.
- At 320×568, the moving copy had a real computed inset clip and did not spill below the panel. Both 320×568 and 390×844 kept document dimensions exactly at the viewport. The 320 clock ended at x141.17 and the Vote button started at x155.17; Select remained inside its card.
- A 350 ms native press produced SVG scale samples from 1/1 through 1.14/0.8 and back. The selected state and vote counter changed normally. The probe also observed only changed countdown glyphs moving across successive time values. The test draft was cleared and no demo vote was submitted.
- Fast close during the flight immediately removed all decorative layers, left zero cards while returning, and retained one canvas. Actual camera arrival still preceded card re-entry. Repeated desktop/mobile opens, closes and resizes kept 10 buffers / 5 programs / 10 shaders / 4 textures and one canvas.
- The reduced-motion public test had zero running document animations, zero renderer draws over 1.1 s and a readable clock. Restoring normal motion after an initial reduced-motion visit left all title words at opacity 1 with no title animation, confirming the reviewed preference-toggle regression is fixed.
- Public console inspection found no app runtime errors; the preexisting optional Cloudflare analytics beacon remains CSP-blocked.
- Visual review: 95/pass, including desktop and narrow intermediate states; verdict stored in `.omx/state/korea-trip/ralph-progress.json`.

## Performance evidence and limits

Before changes, local native 1280×720 country and settled detail each produced 13 draws in roughly 1.13 s with maximum sampled synchronous submission 0.20 ms. A released 1100×820 settled country sample produced 13 draws/1.104 s, maximum 0.40 ms. Different viewports make this a bounded operational check rather than a speed comparison.

A new 390×844 active camera/card sample produced 129 draws/1.134 s, maximum sampled synchronous renderer submission 0.50 ms. The active camera uses the existing display-rate RAF; the settled ambient owner remains 12 fps. No temporary layer remained after that sample. These figures do not measure browser layout/paint/GPU cost or total process CPU.

A separate 50-second unthrottled public load/settled trace reported CLS 0.00 and lab LCP 892 ms. That LCP describes an initial painted element, not completion of the intentional 8.5-second intro. The trace covered automatic entrance and clock behavior, not an interactive card flight. Image delivery and a small render-blocking opportunity remain outside this motion scope.

Physical mobile GPU/battery performance, detailed card-flight paint timing, real hidden/offscreen timing in a host that exposes those signals, and long-session heap retention were not measured. Visibility/preference teardown was source-reviewed and bounded resources were observed across repeated UI navigation. No unavailable check is treated as a pass.

Graphify refreshed locally to 1,076 nodes / 2,249 edges. CSS/fonts are unsupported and the SQL parser dependency is absent; direct UI-source review, rendered checks and existing SQLite tests cover the known index gaps.
