# Native motion implementation research

Reviewed 2026-11-16. Request type: implementation reference lookup. Scope: review only; no runtime, dependency, or deployment changes.

The browser facts below come from current MDN, web.dev, and W3C documentation. Placement, timing, and visual choices are **proposals**, not API guarantees. Project context was supplied by the coordinating reviewer rather than independently audited here: React/CSS/WAAPI; one WebGL globe camera; existing panel/card FLIP; a 12 fps ambient route shader; Noto Sans KR; warm gold, coral, cream, and dark teal; no whole-page vertical scroll.

## Recommended adaptations

### Liquid motion: improve the existing FLIP transition

**Evidence.** `Element.animate()` returns a controllable `Animation`; MDN marks its core API widely available since March 2020. `cancel()` removes its effects and rejects a pending `finished` promise with `AbortError`. An indefinite forward fill retains animation state and can interfere with the style cascade. [Element.animate](https://developer.mozilla.org/en-US/docs/Web/API/Element/animate), [Animation.cancel](https://developer.mozilla.org/en-US/docs/Web/API/Animation/cancel), [WAAPI lifecycle guidance](https://developer.mozilla.org/en-US/docs/Web/API/Web_Animations_API/Using_the_Web_Animations_API#persisting_animation_styles)

**Proposal.** Retain the native FLIP approach. On interruption, capture the currently rendered geometry before cancelling the owned animation, apply the new layout, and animate its inverse transform to identity. Batch geometry reads and layout writes. Set `transform-origin` consistently. Keep one owned animation per animated element, catch expected cancellation, and reject stale completion callbacks so rapid selections cannot restore an old card/panel state. Finish in the canonical CSS/React state and release the animation; do not accumulate forward-filled animations. If committing a temporary interrupted style, clear it when the canonical state takes over.

Use short, finite easing rather than a physics engine or animated width/height. An illustrative review target is 350–550 ms for the principal panel transition, with restrained re-entry stagger; this requires visual comparison against the current behavior. Avoid scaling live paragraphs heavily: geometry can move while text fades or translates independently. No new package or framework transition API is needed. Fallback: render the final layout immediately.

### Kinetic typography: whole lines, small distances

**Evidence.** web.dev recommends `transform` and `opacity`, warns that other animated properties may cause layout/paint, and says to add `will-change` only after observing a problem. This is guidance, not a promise that every transformed element is free. [Animation performance guide](https://web.dev/articles/animations-guide)

**Proposal.** Keep Noto Sans KR and the existing type scale. Reveal a destination heading or short editorial line with opacity and a small translate, once per intentional selection, then stop. Prefer line/word wrappers over character-by-character DOM. Preserve reading order and wrapping; do not animate font size, letter spacing, or a travel description while the user reads it. Illustrative duration: 180–320 ms. Fallback/reduced motion: final text immediately.

### Shape morph: normalize a small decorative shape

**Evidence.** Basic shape interpolation requires compatible value lists and the same reference box. Polygons need the same fill rule and vertex count; CSS `path()` pairs need matching command count, type, and sequence. SVG path interpolation has the same structural constraint. Incompatible paths can switch discretely. `border-radius` values are animatable; CSS `path()` coordinates do not automatically grow with the element as percentage-based shapes do. [Basic shape interpolation](https://developer.mozilla.org/en-US/docs/Web/CSS/Reference/Values/basic-shape#interpolation_of_basic_shapes), [SVG 2 path interpolation](https://www.w3.org/TR/SVG2/paths.html#TheDProperty), [Border radius](https://developer.mozilla.org/en-US/docs/Web/CSS/Reference/Properties/border-radius), [Responsive clipping comparison](https://developer.mozilla.org/en-US/docs/Web/CSS/Reference/Properties/clip-path#shape_versus_path_functions)

**Proposal.** Start with a small border-radius change or percentage-based `clip-path: inset(... round ...)`. If a polygon is needed, author matching point lists in a consistent order; do not expect arbitrary silhouettes to morph naturally. Keep clipping away from controls, focus rings, and essential text. An SVG morph requires intentionally normalized paths and target-browser verification. Avoid making newer `shape()` syntax a requirement. Feature-detect the exact clip syntax; fallback to the ordinary rounded shape. Measure radius/clipping paint cost rather than assuming compositor execution.

### Holographic: a local warm foil sheen

**Evidence.** The core `conic-gradient()` function is widely available since November 2020; newer color syntax has separate support. CSS background images do not expose semantic information to screen readers. [Conic gradient reference](https://developer.mozilla.org/en-US/docs/Web/CSS/Reference/Values/gradient/conic-gradient)

**Proposal.** Use a static, low-opacity conic gradient on an existing selected-card border or small trip badge, tinted to warm gold/coral/teal. A decorative pseudo-element may translate/rotate and fade for one brief hover/focus response; leave the gradient stops static rather than rewriting the gradient every frame. Keep it behind readable content, exclude pointer interception, and retain an ordinary focus indicator. No rainbow full-panel wash, additional shader canvas, or infinite rotation. Fallback: a solid gold border. Reduced motion: the static highlight only.

### Text scramble: optional and tightly bounded

**Evidence.** `aria-hidden="true"` removes an element and its descendants from the accessibility tree; it must not hide focusable elements. Hiding a visible duplicate is appropriate only when equivalent meaning remains accessible. [ARIA hidden guidance](https://developer.mozilla.org/en-US/docs/Web/Accessibility/ARIA/Reference/Attributes/aria-hidden)

**Proposal.** If retained at all, limit scramble to a short nonessential Latin eyebrow on explicit selection, roughly 250–400 ms, never a destination name, price, date, countdown, navigation label, or Korean paragraph. Keep the final semantic string stable in the DOM; animate a noninteractive `aria-hidden` duplicate, without a live region. Preserve reserved width to prevent layout jumps, terminate at the exact final string, and cancel the timer/frame callback on interruption/unmount. Reduced motion or unsupported effect: final text immediately. This is an accessible implementation pattern to test with assistive technology, not an accessibility certification.

### Line animation and route flow: use the existing renderer

**Project integration confirmed by the coordinating reviewer.** The current renderer already has the user-requested bright coral road ribbon and moving ivory highlights (`app/planet-shaders.ts:136`, `app/planet-canvas.tsx:440`). Preserve that behavior and its camera/ambient owner. An additional selection accent, if later requested, should be finite and reuse existing uniforms/progress rather than adding another canvas, loop, camera, or overlay route system. Keep the existing cadence as a baseline to measure, not proof that the result is inexpensive. Reduced motion shows the static route while preserving location information. The external-research lane did not independently audit shader source.

## Lifetime, accessibility, and performance gates

- **Motion preference:** use the existing reduced-motion mechanism across CSS, WAAPI, and WebGL. The CSS media feature is widely available; it represents a preference to reduce, replace, or remove nonessential motion. Prefer an immediate final state here. WCAG 2.3.3 is Level AAA and addresses disabling nonessential interaction-triggered movement; it should not be misreported as an AA requirement. [Reduced-motion reference](https://developer.mozilla.org/en-US/docs/Web/CSS/Reference/At-rules/@media/prefers-reduced-motion), [W3C interaction animation explanation](https://www.w3.org/WAI/WCAG22/Understanding/animation-from-interactions)
- **Visibility:** stop optional animation when its owner is unmounted, inactive, outside the relevant viewport, or the document is hidden. `visibilitychange` exposes page visibility; background throttling is browser policy and should not replace explicit ownership. Intersection Observer can asynchronously gate viewport work but is not proof that content is visually unobscured. Remove listeners/observers and cancel owned callbacks on teardown. [Page Visibility API](https://developer.mozilla.org/en-US/docs/Web/API/Page_Visibility_API), [Intersection Observer](https://developer.mozilla.org/en-US/docs/Web/API/Intersection_Observer_API)
- **No continuous glitch/full-screen filtering:** avoid constant RGB offsets, blur/filter sweeps, animated grain, and flashing chrome. This is a design recommendation based on distraction, rendering work, and the existing globe's cost; performance depends on effect, area, browser, and hardware. Automatic moving information lasting over five seconds alongside other content requires pause/stop/hide unless essential; auto-updating information has a separate rule without that five-second exception. [W3C pause/stop/hide explanation](https://www.w3.org/WAI/WCAG22/Understanding/pause-stop-hide)
- **Measure before implementation:** capture comparable idle and active traces at desktop and a representative mobile viewport; compare frame time, scripting, paint/composite activity, and retained animation/canvas/listener counts after repeated navigation. Check hidden-tab and reduced-motion behavior. Transform/opacity is the preferred starting point, not measured proof. No CPU, memory, battery, or frame-rate claims were established in this review. [Rendering guidance](https://web.dev/articles/animations-guide)

## Review outcome

The smallest coherent implementation direction is existing WAAPI FLIP plus a little transform/opacity type motion, one local warm sheen, and preservation of the current route flow. Arbitrary SVG silhouette morphs are optional; the main review separately prioritizes card-to-panel rectangle continuity. Text scramble is lower priority. Keep native final states usable without the effects. No architecture inspection, implementation, browser/device tests, performance baseline, or new dependency evaluation was performed in this external-research lane.
