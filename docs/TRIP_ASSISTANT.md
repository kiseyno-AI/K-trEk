# Local trip assistant

The assistant is local-only. `/api/assistant` and assistant-message speech require a loopback Host/forwarded Host via `localTripVoiceAvailable`, the existing authenticated member session, exact same-origin writes and JSON. The public proxy supplies its own public forwarded Host, so the assistant cannot be enabled there by a browser header. This implementation does not deploy or modify a database. Migration `0007_trip_assistant.sql` adds only sessions, typed events and server-owned reply messages.

## Request contract

All calls are `POST /api/assistant`, with a maximum 8,192-byte body. Unknown fields are rejected. Session and event IDs allow 8–100 ASCII letters, numbers, underscores and hyphens; UUIDs are supported. Activity IDs must identify a currently published card.

```ts
type AssistantMessage = {
  id: string;
  text: string; // English, at most 1,200 characters
  sources: { activityId: string; title: string; url?: string }[]; // at most six
  reportDraft?: string;
};

// Records an interaction, even with sound off.
{ kind: 'event', sessionId, eventId,
  event: 'card_open' | 'session_tick' | 'favorite_added' | 'vote_added',
  activityId?, elapsedSeconds: number, voiceEnabled: boolean }
// -> 200 { reply?: AssistantMessage }

// Explicit questions work with sound off. The trimmed question is 1–1,000 chars.
{ kind: 'chat', sessionId, message: string, activityId? }
// -> 200 { reply: AssistantMessage }

// The client sends this only after native audio playback actually begins.
{ kind: 'heard', messageId }
// -> 200 { ok: true }
```

`card_open`, `favorite_added` and `vote_added` require an activity ID. Session ticks may omit it. Visitors receive 401; bad payloads 400; unsupported content types 415; cross-origin writes 403; public-host and unowned-message requests 404; request-rate limits 429; storage failures a generic 503. Refusals and grounded fallbacks use the normal reply envelope.

## Typed behavior and persistence

Events are unique per user/session/event ID. Replayed events do not increment counts or repeat a reply. Recent comparison history includes only the last five card opens within five minutes. ABABA between two different cards takes priority over three or more opens of the same card; one hour of recorded active use is a third rule. Patterns are claimed atomically in the session row, with at least five minutes between proactive replies. Comparison pairs and repeated-card patterns are each claimed once per session. An already-handled higher-priority pattern cannot permanently block the one-hour suggestion. Typed server introductions always retain the actual revisit count or about-one-hour acknowledgement. Comparisons always offer an early invitation to ask Shawn for a recommendation, preserve both observed cards in the sources, and attach a generic recommendation draft even when an agent adds facts about only one of them.

Active seconds increase monotonically, bounded by the submitted cumulative active time, real server wall time and at most 90 seconds per event; the total is capped at 86,400 seconds. A first event cannot claim an hour by submitting a large duration. Full-session per-card counts remain available independently of the five-minute comparison window. Favorites, categories and vote selections are read only for the authenticated account and filtered to published cards.

When `voiceEnabled` is false, an event is recorded but no proactive message is generated, no agent is called and no speech is requested. Explicit chat is separate. Event receipts are limited to 120/minute/member, chat to 12/five minutes/member, and heard receipts to 120/minute/member. Provider generation has a persistent 12/five minutes/member and 100/hour global budget, plus two simultaneous calls per handler isolate.

Sessions/events contain only typed enums, IDs, counters and server timestamps. Raw chat questions are never persisted. Stored messages contain validated grounded reply text, source references, a typed trigger, optional generic public-trip report draft and heard timestamp. A rejected private question can store only a fixed generic refusal, without the question or its personal data. No assistant path reads another member's preferences or private reports. No report is sent automatically; `reportDraft` requires the separate existing report form and explicit user submission.

## Grounding and provider isolation

`retrieveTripContext` receives published activity records, site facts and the current member's typed trip summary. Its whitelist excludes authentication data, reports, other-member data, private relationship facts, free-form host comments and external memories. It bounds the published catalog/index and selected details to 32 KB. `validateTripAssistantAnswer` binds activity IDs, source URLs and numeric claims to retrieved evidence; refused, malformed, unrelated or unsupported answers fall back to deterministic published facts.

The provider is called only when both the existing gateway token and `OPENCLAW_TRIP_ASSISTANT_ISOLATED=true` are present. The fixed model is `openclaw/ktravel-assistant`. The dedicated agent must be independently configured with context injection disabled, no memory/search/remember behavior, no skills, and all tools denied. Runtime sends `store:false`, `tools:[]`, `tool_choice:'none'`, and no `user`, session identifier, previous-response ID or browser routing headers. The gateway's verified behavior creates a fresh agent-scoped conversation for each such request. Configuration is owned and verified separately by the parent integration task.

Agent generation has a hard 12-second chat / eight-second proactive deadline, including a provider that ignores cancellation, and a 65,536-byte response limit. Provider failures or invalid answers use grounded deterministic fallbacks. Request cancellation aborts work and cannot persist a late answer.

## Speech

`POST /api/voice` accepts `{event:'assistant',messageId}`. It resolves only the current member's stored message. No raw speech text, alternate user ID or client prompt is accepted, and this text never passes through an agent rewrite. Speech uses an unchanged server-owned excerpt of at most 300 characters and 45 words, preferring a sentence boundary. The audio transcript header matches that excerpt while the full reply remains in chat. Existing ElevenLabs bounds, caching and paid-call throttles remain in effect. Client playback records both the full reply and spoken excerpt as heard only after native playback begins.

Legacy welcomes now use a general named Korea greeting for every member. No special personal-relationship greeting is sent to the legacy voice agent.

## Verification

`tests/trip-assistant.test.mjs` exercises public request handlers with real SQLite migrations, a D1 adapter and actual session authentication. It covers local/origin/identity gates, typed and bounded bodies, event deduplication, duration clamping, rule priority and cooldown, comparison recency, one-hour behavior, per-member throttles, private-context exclusion, isolated provider payloads, finite cancellation-ignoring provider deadlines, stored heard receipts and explicit report drafts without automatic sends. `tests/trip-voice.test.mjs` verifies own-message-only TTS, short speech excerpts, unchanged provider controls and privacy-safe generic welcomes. Context retrieval has its own focused regression suite.
