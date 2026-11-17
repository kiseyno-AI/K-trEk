# Local trip host: voice and chat

The existing loopback-only `TripVoiceControl` has one header Voice button that opens the native trip dialog even with speech off. The sound on/off toggle is inside that dialog; there is no separate header Chat button. The parent retains the existing server/local host gate; public pages do not expose these controls. Chat works with sound off. Visitors can open the dialog and choose the existing sound preference, but have no question field or report action. The UI uses the existing Noto Sans KR, cream detail surface and dark teal controls, native buttons/textarea and one native dialog; it adds no animation or dependency.

## Explorer integration

The memoized `TripVoiceHost` owns `useTripVoice({user, ready, activityId?, onSessionExpired?})`; it exposes only `activityOpened` and `selection` through `TripVoiceActions`. The explorer calls `activityOpened(id)` only when a real card detail opens, `selection(id, 'favorite_added')` after a confirmed favorite addition and `selection(id, 'vote_added')` after a successful vote addition. Removals and rejected additions do not record additions. The focused/detail activity ID supplies chat context. The parent mounts the owner only under the existing local feature gate. Typing/opening never renders the explorer/globe, and unchanged countdown ticks skip the assistant. [Measured comparison](VOICE_INPUT_PERFORMANCE_0_3_1.md).

Each signed-in local identity owns a player and one interaction client. Changing identity disposes both, aborts requests, clears UI history and reloads the new account's separate browser ledger/session. Readiness and document visibility determine active time. Returning to a tab resumes interaction recording, without resuming interrupted speech.

## Heard speech

`createTripVoicePlayer.setIdentity(id)` loads `ktravel-heard:<encoded account ID>` from localStorage. The bounded ledger retains separate greeting/selection flags plus up to128assistant event IDs and128normalized texts. Normalization uses Unicode NFKC, case folding and collapsed punctuation/spacing. Generic greeting and excellent-choice flags survive ledger text eviction. Turning sound off/on never clears this ledger. Browser storage failure degrades to the same in-memory session ledger; clearing browser storage can allow the old short greeting/static reaction again.

A response fetch, a failed decode, autoplay rejection or a canceled play never counts as heard. Only successful native `audio.play()` Promise fulfillment records the event/text. The fixed excellent-choice MP3 plays once per signed-in account across different cards, toggles and reloads. Blocked audio retains its URL for explicit Play voice; failed audio may be retried through the same event. The old twelve-second reaction gap remains an additional playback bound.

Assistant TTS sends only `{event:'assistant',messageId}`. The server owns and authorizes the stored reply; arbitrary client text is never sent to the speech endpoint. Chat retains the complete reply. The caption uses the actual `x-trip-voice-text` transcript, including the server's short spoken excerpt. After native playback succeeds, both that spoken excerpt and the full original reply enter the ledger, and the stored message ID is marked heard through `/api/assistant`. Equivalent later text does not speak again under a different message ID.

## Chat and reports

The native dialog restores focus to its Voice launcher when closed. Chat requests or speech loading show a static `...` output named Thinking and disable both the question field and Send; the submit handler also rejects a delivered submit while loading. The sound toggle stays available so speech can be muted. This adds no animation or timer.

The native dialog has an English trip-only heading, readable conversation log, source links, a labeled question field limited to1,000characters, Send, loading/error/retry, explicit close and native Escape/focus containment. Long history scrolls inside its pane; page scroll is unchanged. The visible history retains at most20messages. Failed questions keep their input and expose Retry question; voice failure leaves the textual answer available.

A server reply may contain a report draft. The UI shows the draft with an explicit Ask Shawn button. Rendering, generating or speaking a draft never creates a report. Only that button POSTs its displayed draft to the existing `/api/reports`; the confirmed action becomes Sent to Shawn. Duplicate in-flight clicks are guarded. This lane's tests use fixtures and sent no actual user report.

## Resource baseline and budget

Before this update, the player already owned at most one audio element, one request deadline, one validated static MP3 Blob of512KiB or less and one live object URL. It had no animation/RAF/poll/interval. Those media limits remain. Stop, mute, hidden document, pagehide, identity change and disposal abort/release pending speech and media sources; disposal removes native media/lifecycle listeners. The audible-transcript dedupe adds bounded strings and no timer.

The interaction client adds one visible-only60second heartbeat timeout, a bounded32-event outbox in account-scoped sessionStorage and finite request deadlines:20seconds for chat and12seconds for event/heard/report requests. It establishes a new visible session immediately with a zero-time `session_tick`, then records card opens, successful additions and visible active duration. Background time is excluded. No agent is requested for ordinary sound-off events. Pagehide sends one quiet keepalive duration snapshot; its same event ID remains queued if interrupted. The normal visibility path stops the heartbeat and aborts active requests; unmount/identity change also clears every owned deadline.

Deterministic lifecycle checks run20client create/dispose cycles with an unresolved fetch: every cycle ends with0retained timers and all request signals aborted. Existing player ownership coverage repeats21play/stop cycles using one media object, with all21object URLs revoked and both native listeners removed. These public browser-boundary tests establish resource/order bounds, not hardware decoding latency, actual speaker onset, whole-process CPU or browser heap size. The new chat surface has no motion; reduced-motion users receive the same native controls.

## Verification and remaining browser checks

Run:

```
node --experimental-strip-types --test tests/trip-voice-player.test.mjs tests/trip-interaction-client.test.mjs tests/trip-voice-ui.test.mjs
```

The focused tests cover per-account reload/toggle suppression, fixed-line dedupe, transcript excerpt/full-text dedupe, autoplay retry, finite playback resource cleanup, event logging with sound off, initial session start/restoration, hidden-time exclusion, one-minute heartbeat pause, bounded outbox/idempotent IDs,20-cycle timer disposal,20second chat deadline, malformed replies, unauthorized sessions, source rendering and explicit-only report submission. Scoped lint and full TypeScript accompany them.

The parent owns registry integration and actual rendered local desktop/mobile QA: native dialog focus/Escape/restore, narrow header wrapping, readable long message/source/report content, no page overflow, voice off text chat, local server persistence and repeated hide/return/navigation. No paid generation, public deployment, database migration or real user message occurred in this implementation lane.

The earlier existing voice baseline was measured in Chrome/macOS at1920×873: login294DOMelements/no media, visitor337elements/one canvas/no audio, and map synchronous draw submission0.20ms with10buffers,5programs,10shaders,4textures and12,492lights. These are historical renderer-submission/resource observations, not new chat CPU/heap measurements. The prior local/public control boundary was also visually verified at320×844; the current Voice dialog still needs the parent's current render check. Safari and physical audio onset remain unmeasured.
