# Local trip assistant v0.3.0

This release combines complete-row grid pages with a trip-scoped chat/voice assistant. Work remains local; production dist, public deployment, production database and public proxy are not changed.

## Isolation and retrieval

The dedicated OpenClaw agent is `ktravel-assistant`, explicitly selected per request. Its separate workspace has only a public-scope README; context injection is disabled, memory search/cross-conversation remembrance disabled, skills empty and tools denied. Request tools are empty, storage false, and user/session/previous-response routing fields are omitted, yielding a fresh request session. The personal/default agent and existing unrelated configuration remain unchanged. Config schema/dry-run/actual validation passed and a single public-fixture canary completed successfully. The existing private runtime environment now has an isolation-confirmation boolean; no credential value is in the repository/browser.

Retrieval searches all 114 published activity identities, selects relevant public venue facts and includes an explicit site-fact whitelist, plus only the current member's typed trip choices/usage. It excludes authentication, credentials, other members, reports, private memories and personal relationship material. Host comments/ratings are outside the retrieval field allowlist; venue descriptions, public booking/group conditions and Google verification fields are included. Raw user chat questions have no persistence column. Private/offtopic questions are refused before provider calls; only a generic refusal may be stored. Replies validate source identifiers/URLs against retrieval, retaining null/unverified facts instead of inventing bookings, ratings, medical advice or live route data.

## Interaction rules

Typed authenticated events record card opens, successful favorite/vote additions, session start/visible usage heartbeats and final flushes. Event identifiers are idempotent. Elapsed usage is clamped server-side, and requests/queues are bounded. Recent two-card ABABA alternation, repeated card opens and an hour of active browsing can trigger a short host comment, with per-pattern claims and a five-minute proactive cooldown. Passive event recording with Voice off does not call the language/speech providers. Chat is an explicit text request and works with sound off.

Heard greetings, generic reactions, assistant IDs and normalized full/spoken text are remembered per account. Marking occurs only after native playback starts, so blocked/failed playback can still be retried. Muting, backgrounding and disposal stop audio/requests; toggling sound never clears the heard ledger. Longer chat answers retain their full written text while speech uses a bounded server-owned excerpt.

Chat and sources use the existing native dialog/theme. Ask Shawn is a separate explicit action that writes the existing report endpoint; no report is automatically sent. No new dependency or media/animation loop is added. Client owns a visible-only one-minute heartbeat, bounded outbox and finite network deadlines; the existing player owns at most one audio element/source.

## Verification

Final integration on 2026-11-16:

- `npm test`: **271 passed**, zero failures/skips. Includes real SQLite migration/authentication tests, scoped RAG validation, visible-time/event persistence, rule priority, one-hour thresholds, heard-ledger toggles/reloads/two-player races, blocked-play retry and client disposal.
- `npm run lint`, `npx tsc --noEmit`, `git diff --check`: passed. `npm run ui:check`: nine component families, 63 reviewed sources, 67 free patterns.
- Actual localhost HTTP against the development D1 store: rapid alternating card events and a duplicate were accepted exactly once, the comparison contained both sources and an explicit report draft, integer/clamped duration persisted, and private/offtopic questions received generic refusals. No report was sent. The temporary account and its cascading session/event/message rows were removed afterward; final QA-account count is zero.
- A real isolated-provider canary completed. A real Chat question about Samwon Garden returned a generated, source-grounded answer with only Samwon as its source. The final two-restaurant comparison returned exactly Balwoo/Samwon and the explicit Ask Shawn action. Shared Garden words, `our` inside Tour and `one` inside Stone are covered by regressions; secondary official source URLs validate only for cited retrieved records.
- Browser: Chat works with Voice off; native Escape restores Chat-button focus. At 390×844 and 320×568 the dialog/input stay in bounds without horizontal overflow. The mobile icon submit button retains its accessible `Send` name. Fresh navigation completed the intro and rendered with no warning/error logs. Actual voice synthesis/speaker playback was not requested during this browser pass.

| Grid viewport | Rendered cards | Partially clipped cards | Page count |
| --- | ---: | ---: | ---: |
| 1920×900 | 10 | 0 | 12 |
| 1920×1080 | 15 | 0 | 8 |
| 390×844 | 3 | 0 | 38 |
| 320×568 | 0; List/taller-window notice | 0 | Pager hidden |
| Default 1280×720 | 3 | 0 | 38 |

Next-page navigation and detail/back preserve the page at an unchanged viewport. Attempted grid wheel scrolling leaves grid/document offsets at zero. List remains a maximum five mounted cards with no grid pager. Screenshots: [complete rows](../.impeccable/review/whole-grid-rows-v0.3.0.jpg), [travel comparison chat](../.impeccable/review/trip-chat-v0.3.0.jpg).

## Resource ownership and limits

The reproduced grid baseline mounted 15 cards at 1920×900 with five clipped; the corrected view mounts ten complete cards. The existing scene's observed JS draw-submission sample was 0.10 ms before and 0.10–0.20 ms afterward, with the same four textures, ten buffers, five programs and ten shaders (41,943,041 estimated texture bytes). This is a submission sample, **not** a GPU frame-time or whole-process CPU measurement. No new render/animation loop was added.

One grid observer disconnects on unmount; its fallback listener also releases. Twenty client create/dispose cycles retain zero heartbeat timers and abort active work in the lifecycle tests. Hidden/pagehide and reduced-motion behavior are covered by fixtures and the unchanged existing animation checks. This IAB surface reported multiple tabs as visible, so actual OS-background throttling was not established here. No one-hour wall-clock soak, physical speaker onset or fresh whole-process CPU profile was performed.

Migration `0007` was applied only to `.wrangler/local-state`, after a private backup. Final read-only checks found three assistant tables locally and zero in `.wrangler/state`; both local and public home URLs returned HTTP 200. The dev process was restarted only to read the private isolation flag. No public build, deployment, proxy change or production migration was performed.

The code-only Graphify index was refreshed: 1,389 nodes / 3,091 edges; retrieval callers were checked against current source/tests. CSS/assets are unsupported by that index, and SQL extraction lacks `tree_sitter_sql`; those paths were reviewed directly and SQLite/CSS behavior verified separately. No new dependency was installed.

## Change map and simplifications

- Complete-row pagination: `app/activity-explorer.tsx`, `app/globals.css`, `lib/activity-pagination.ts`; removed inner grid scrolling and offset-reset bookkeeping.
- Chat and lifecycle: `app/trip-voice.tsx`, its CSS module, `lib/trip-interaction-client.ts`, `lib/trip-voice-player.ts`; reused the native dialog, existing audio owner, sessions and report endpoint.
- Retrieval/rules/storage: `lib/trip-assistant-context.ts`, `lib/trip-assistant.ts`, `lib/trip-assistant-store.ts`, `app/api/assistant/route.ts`, migration `0007`; stored-message speech uses the existing voice route/service.
- Version, local isolation documentation, focused regression tests and the component registry were updated. No vector service or agent tools/files were added; the small catalog uses bounded lexical retrieval and safe fallback.

Known boundaries: heard-content storage is per account in this browser and bounded to 128 IDs/texts, not synchronized across devices. Clearing browser storage or evicting older entries can permit an old line again. Lexical output checks cannot prove every arbitrary generated sentence is supported; data minimization, agent isolation and deterministic fallback remain necessary. Live routes/fares and booking availability still belong to their dedicated verified flows.
