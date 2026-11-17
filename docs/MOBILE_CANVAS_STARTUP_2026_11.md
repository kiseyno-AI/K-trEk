# Canvas startup failure containment — 2026-11-16

## Evidence and limits

The user reported a real Android Chrome visit remaining on the globe. The parent’s public Chrome390×844/DPR3,4×CPU/Slow4G run reached the login and Korea view, with assets around10seconds. That lab run does not reproduce or identify the physical Android cause.

Source review found deterministic failure paths: context acquisition, ResizeObserver construction and shader compilation/linking occurred before the asynchronous asset catch. Throwing there escaped the component effect, never marked the renderer unavailable and never released browse readiness. A controlled VM of the actual component reproduced zero readiness callbacks and an uncaught error for shader/observer failures; ordinary getContext=null already had a later fallback. The initial six regression cases all failed before the fix.

The login timer itself is independent of map readiness. The minimum8.5second intro ends in the explorer; country readiness gates card arrival after access is granted. The parent separately bounded the initial session lookup, which had been another unbounded wait. This renderer change does not claim the missing onBrowseReady callback was the observed device’s exact cause.

## Implementation and ownership

The existing persistent PlanetCanvas owns a guarded startup and an idempotent release stack. It contains synchronous initialization errors, failed asset initialization, context loss and subsequent rendering exceptions. Failure marks renderer=unavailable with a small diagnostic reason, releases work and notifies the existing browse callback when outside detail. The app can continue through its normal functional fallback rather than losing the parent’s startup effects.

One finite18second startup deadline bounds asset/bitmap readiness. It aborts pending network work on failure and is cleared as soon as normal readiness is reached, or on unmount. It is not a permanent poller. Existing startup delay, geographic movement, light counts, source textures, pixel ratio, shaders, geometry, ambient cadence and normal camera timings are unchanged.

Resource ownership now includes partially allocated shaders/programs/buffers/textures, both observers, all listeners and the existing frame/intro/ambient handles. A successful vertex shader is enrolled before fragment compilation, so a fragment failure cannot orphan it. Cleanup continues if a native release itself fails. It clears measureRef/updateRef, observed label boxes and active marker opacity. Update and draw callbacks stop after disposal; a failed draw cannot enqueue a new frame or ambient tick.

Each decoded ImageBitmap closes in a finally block even if texture upload/mipmap generation throws. A bitmap that finishes decoding after disposal closes immediately without uploading into a deleted context. The decoder API itself is not forcibly cancelable; this is eventual bitmap ownership, not a claim of preempting a native decode.

## Regression seam

`tests/planet-startup.test.mjs` transpiles and mounts the actual component function in a controlled hook/native API fixture. It executes the real setup, async readiness, callback and cleanup code with tracked GL objects/observers/listeners/timers/RAF and injectable platform failures. It does not assert source substrings or emulate physical GPU execution.

Ten focused cases pass:

- Fragment shader failure, program link failure, unavailable ResizeObserver and throwing context getter cannot abort parent startup and leave zero tracked work/resources.
- Nine stalled asset requests abort at18seconds and release the browse gate.
- Context loss and repeated cleanup are idempotent; unmount while loading retains no work.
- Normal readiness clears its deadline, closes four bitmaps, retains10buffers/fiveprograms/fourtextures and completes the original orbit-to-Korea flight.
- A later draw exception leaves no newly scheduled frame or ambient tick.
- Late decoded bitmaps close without uploads after disposal.
- A texture-upload exception closes all four decoded bitmaps; its added regression failed0closed/4expected before the finally fix, then passed.

Scoped lint, TypeScript and diff checks accompany these cases. Parent owns rendered mobile/desktop QA, combined registry/gates, graph refresh and publication. Physical Android GPU/driver failure, battery, native resource measurements and actual background scheduling remain unverified by this VM seam.
