# Voice input responsiveness — local v0.3.1

The user located the slowdown in opening Voice and typing. The previous `useTripVoice` call owned chat, speech and request state inside `ActivityExplorer`, so every character rendered the page and all non-memoized descendants. The existing one-second countdown also rendered the assistant. There was no evidence that typing restarted the globe, card animation or route request.

## Reproduction and measured comparison

Before the change, 80 actual input-state updates through the page produced 82 root renders including initial/open. The retained public-callback regression failed with four unwanted root renders after opening the dialog and three text changes. The fixed regression requires zero page/globe renders for those actions, preserves card-open/vote forwarding and verifies a countdown tick skips the unchanged assistant.

Actual Chrome/macOS at 1920×873, same account, catalog, list view and 33-character question (`Compare Samwon Garden and Balwoo.`), with speech off:

| Observation | Before | After |
| --- | ---: | ---: |
| Root renders during typing | 36, including three clock ticks | 2 clock ticks, no input-caused render |
| Input event → next RAF mean | 10.05 ms | 4.11 ms |
| Input event → next RAF maximum | 11.80 ms | 10.40 ms |
| Aggregate React commit work during the typing interval | 142.4 ms | 83.4 ms |

Temporary React Profiler and input/RAF probes collected these numbers and were removed from shipped source. They measure local React work and an input-to-next-animation-callback interval, **not** field INP, GPU completion, physical-display latency or the user's worst observed stall. The typed interval includes unrelated countdown commits and tool keyboard delivery. No prompt, credential or private message was captured in performance artifacts. The separate IAB baseline was 6.13 ms mean / 10.10 ms max for 79 delivered input events; it is not mixed into the Chrome comparison.

## Smallest fix

`TripVoiceHost` is a memoized owner of the existing hook. Its small ref interface exposes only `activityOpened` and `selection`; the page supplies identity/readiness/current-place context. Opening, typing and speech/request state now update that owner alone. Native ref teardown and the existing identity-owned client/player cleanup remain in use. The existing countdown, globe quality, lights, resources and camera are unchanged.

One header **Voice** button opens the existing dialog with speech off or on. The sound toggle is inside; the separate Chat button is removed. Chat, speech preparation and sound-enabled proactive requests share a static, accessible **Thinking** `...` status. While thinking, the textarea and Send are disabled and submit/retry handlers are guarded. Quiet event logging does not block typing. Proactive thinking clears on reply, mute, hidden state, error/deadline or disposal; no new timer or animation is added. Visitors retain a read-only dialog with no question/report controls.

## Verification

- `npm test`: **277 passed**, no failures/skips. `npm run lint`, `npx tsc --noEmit`, `git diff --check` and `npm run ui:check` pass (nine families / 63 reviewed sources). Includes the red-before-green ownership, public-control and interaction-client checks above.
- Real local UI: a Voice click opens the dialog without starting speech; sending a trip question displays `...` with disabled textarea/Send. Text becomes writable again after the actual sourced/site-grounded reply. At 320×568 the dialog/input remain in bounds with equal 296 px scroll/client width; Escape restores the sole header Voice button. The final page has no temporary diagnostic attributes. [Thinking screenshot](../.impeccable/review/voice-thinking-v0.3.1.jpg).
- Five real close/open cycles retain one dialog, one canvas and zero audio elements while sound is off. Four textures / ten buffers / five programs stay constant. No speech was generated in this browser check; one ordinary text question exercised the existing provider.
- Existing media/client lifecycle tests cover one audio owner, revoked URLs, finite requests, visible-only heartbeat and repeated disposal. The new thinking signal owns no listener, observer, timer or graphics resource.
- The retained countdown reads the actual click time before accepting a vote. A narrow documented compiler-lint exception preserves that existing deadline guard after the mutable child-action ref changes purity inference; no stale render-time deadline is substituted.

Main changed sources: `app/activity-explorer.tsx`, `app/trip-voice.tsx`, `app/trip-voice.module.css`, `lib/trip-interaction-client.ts`. Coverage: `tests/trip-voice-ownership.test.mjs`, `tests/trip-voice-ui.test.mjs`, `tests/trip-interaction-client.test.mjs`; version and component registry/documentation updated. No dependency, database migration, provider routing, public build or deployment was added. Graphify was refreshed to 1,404 nodes / 3,125 edges; its CSS/asset and missing SQL-parser coverage gaps remain covered by direct review/tests. The mechanical design scan used regex only and does not establish live contrast or browser performance.

Limits: severe device-specific lag was not reproduced in the bounded desktop sample. Physical Android/Safari, GPU timing, a long-session heap profile and real background scheduling remain unchecked; existing hidden/reduced-motion lifecycle fixtures remain the evidence for those branches. Agent response time is a separate network/provider wait and has not been shortened by this rendering fix.
