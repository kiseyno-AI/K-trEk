# Trip assistant context boundary — local implementation

`lib/trip-assistant-context.ts` is a pure retrieval/validation boundary. It does not read a database, workspace, configuration, network, member list, reports, passwords or prior chats. The authenticated server supplies published `ActivityRecord[]` and only the current member’s typed trip summary.

## Contract and retrieval

- `retrieveTripContext({message, activityId?, activities, preferences?})` returns `allowed`, optional `refusal`, `system`, serialized `context`, `sources`, `fallbackText`, retrieved `activityIds`, and validation evidence.
- `validateTripAssistantAnswer(value, context)` accepts only `{answer, activityIds, sourceUrls}` or returns `null`; the server uses the deterministic fallback when generation is unavailable or rejected.
- English/Korean names, category/region aliases and public card content are searched lexically. Full names outrank partial names and content. A singular full-name query selects only explicitly named places; shared title words such as Garden cannot add unrelated records. Explicit comparisons can add a partial alias only when a residual title token identifies one catalog place, after removing the full matched names. Latin aliases match whole normalized title tokens, so prose such as “our” cannot match “Tour” and “one” cannot match “Stone”; Korean aliases retain substring matching. A current card resolves “this place.” A compact catalog exposes all published identities; at most six relevant cards provide detailed facts.
- Context plus instructions is capped at 32,000 UTF-8 bytes. Detailed records are dropped from the end before an oversized request is refused. Text fields have independent limits. Answers are capped at 1,200 characters.
- Source URLs originate only from retrieved rows, require public HTTPS, and exclude credentials, local/private addresses and secret query parameters. Each displayed source has an optional primary URL. Answers may cite only returned activity IDs and any exact sanitized URL in the retrieved detail records associated with those cited IDs; the UI still exposes one primary source link per card. Both activity and URL citations remain capped at six.

The public field allowlist includes venue names/locations, experience descriptions, planning versus operator duration, public venue contact and booking conditions, group limits, explicit English-support statuses, Google verification status, nullable stored driving duration, verification evidence/date, and source URLs. Host free-text comments, personal stories, account data and report content are excluded. Known instruction-injection/private-text patterns are removed from card fields; every remaining card field and URL is explicitly identified as untrusted data in the model instructions.

## Scope and output checks

The pre-provider scope guard refuses personal contact/home/location/family/job data (including volunteered home addresses), host/private relationship questions, credentials/workspaces/memories, other members, private reports and unrelated requests. Public venue phone/address questions and asking a host to confirm public trip details remain allowed. Password _setup help_ is distinct from reading a password. The site-help whitelist explains only cards, category/list/grid controls, hearts, votes, sign-in, report submission and the detail transport panel.

Own usage is limited to server-supplied category IDs, published favorite/draft/submitted IDs, recent/comparison IDs, repeat-view counts and active browsing seconds. Unknown IDs are discarded. Draft and submitted votes remain distinct; generic vote questions use their deduplicated union. Viewed/clicked/recent questions use recent card history, independently of favorites and revisit counts. The current open card cannot add an unrelated record to own-history retrieval. Repeat views are reported as views, not as inferred preference. No member names or free-text chat history enter this summary.

Output validation checks the exact JSON shape, bounded cited IDs/URLs, forbidden/private/instruction patterns, numerical evidence, unknown opening hours, unverified Google metrics, unsupported Michelin-star claims and reservation guarantees. Unknown hours are not manufactured from links. Live routes/fares come from the detail transport panel, not model knowledge.

Limit: lexical scope/injection/claim checks are defense in depth, not proof of arbitrary prose entailment or a universal prompt-injection detector. The security boundary is data minimization plus a dedicated tool-free agent. Keep deterministic fallback for rejected output; add a regression when a new false positive or unsupported claim is observed. No embeddings, vector service, model access to private files, or external web crawling were added for this small catalog.

## Read-only OpenClaw isolation audit

Inspected the installed runtime/config structure without printing secret values. Configuration is `/Users/shawn/.openclaw/openclaw.json`, agent collection `agents.entries`. The existing `ktravel-voice` workspace contains personal host material and must not be reused for retrieval, prompts or assistant bootstrap.

The leader owns applying/verifying the dedicated `ktravel-assistant` entry: fresh workspace/cwd, explicit model, `contextInjection: "never"`, disabled memory search and cross-conversation remembering, empty skills, and minimal tools with `deny: ["*"]`. The site server must select `openclaw/ktravel-assistant` explicitly and use fallback unless isolation is confirmed; never select the ambient default/main agent.

Installed-runtime evidence:

- `/opt/homebrew/lib/node_modules/openclaw/dist/schema-B5pKhM6L.mjs` supports the per-agent isolation fields; explicit agent routing takes priority over the ambient system agent.
- `/opt/homebrew/lib/node_modules/openclaw/dist/http-utils-CyRy3OBs.mjs:153` derives a fresh UUID session when neither body `user` nor `x-openclaw-session-key` is provided. Supplying `user` creates a stable reusable session key.
- `/opt/homebrew/lib/node_modules/openclaw/dist/openresponses-http-BJy5UyOr.mjs:508` can reuse a prior response session only when `previous_response_id` is supplied.

Therefore each assistant request omits `user`, `previous_response_id` and session/routing headers. Use `store: false`, `tools: []` and `tool_choice: "none"` in addition to the isolated agent configuration. This audit did not mutate configuration or send private facts to a provider. The leader owns the live isolated-agent canary.

## Verification

Eighteen helper public-interface tests cover bilingual/partial retrieval, comparisons, category filtering, nullable facts, personal/off-topic refusal, allowed public host questions, own usage/time and distinct vote states, injected card text/host comments/credential URLs, citation and numeric/unknown output validation, Korean venue-name false positives, private report/member-list refusal, all 114 catalog identities under the context budget, oversized-catalog refusal, shared-name-word collisions against both small fixtures and the real 114-row catalog, mixed full/partial comparisons, recent-view versus favorite routing, and generic submitted-vote visibility, and secondary official-source citations without allowing unrelated or uncited-card URLs, and the exact public-host comparison question with Tour/Stone distractors while preserving Latin and Korean partial comparisons. Combined helper/backend tests and TypeScript/lint are run at integration. No dependency or production/config/database changes belong to this helper slice.
