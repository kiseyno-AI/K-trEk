# Local trip community APIs

This change adds `0006_trip_community.sql`, containing only `trip_member_preferences` and `trip_reports`. It does not alter accounts, passwords, activities, or existing favorites. No database migration or public deployment is performed by this implementation lane. Apply the migration to the isolated development database before testing the new UI.

All endpoints use the existing server-side `ktravel_session`. Every response is private (`Cache-Control: no-store`, `Vary: Cookie`); writes require an exact same-origin `Origin` header and `application/json`. JSON bodies are limited to 65,536 bytes, including streamed bodies. Identity and permissions come from the stored session user, never payload fields. Unknown fields, invalid IDs, duplicates and wrong types are rejected. An expired session returns 401; insufficient permissions return 403; invalid payloads return 400; rate limits return 429; unavailable storage returns a generic 503.

## Preferences

`GET /api/preferences` and `PUT /api/preferences` return:

```json
{
  "preferences": {
    "categoryIds": [],
    "draftVoteIds": [],
    "submittedVoteIds": [],
    "updatedAt": null
  }
}
```

PUT requires `categoryIds`, `draftVoteIds` and `submittedVoteIds`, and accepts optional boolean `submitVote`. Category IDs must be one of the eight keys in `CATEGORIES`; `all` is not a preference. Both vote lists allow up to 20 unique IDs. Draft IDs must be published. Ordinary autosync updates categories/drafts and atomically preserves any submitted ballot, even when a stale browser sends an empty list.

Only `submitVote: true` replaces the member’s submitted ballot: 1–20 published activities before the shared voting deadline (2027-01-15 23:59:59 America/New_York). It returns 409 after closing. Each account sees and writes only its own row. Resubmission replaces that row and counts once per member. Success is displayed only after a canonical persisted response; failures preserve the draft and allow retry. GET restores submitted votes from D1 rather than trusting browser storage. `updatedAt` is the last preference save, not a dedicated ballot submission timestamp. A member may save up to 120 times per minute. Hidden activities are omitted from reads.

Shawn and Sun administrators can `GET /api/members?view=votes`. It returns only nonempty submitted ballots as `{"votes":[{"id":"...","name":"...","submittedVoteIds":["..."]}]}`. The header’s Votes dialog aggregates one vote per activity per member and lists named ballots; it loads on opening or explicit retry, never polls. Ordinary members and visitors cannot read group votes. Reports and the full member-preference endpoint remain Shawn-only. No new table or migration is required beyond existing `0006_trip_community.sql`.

Older browser-only submissions cannot be recovered centrally without the participant returning and submitting them. Refresh the site and use Submit vote to confirm them in D1.

## Reports

Any signed-in account can `POST /api/reports` with exactly `{"message":"..."}`. The trimmed message must contain 1–2,000 characters. The response is `201 {"report":{"id":"...","userId":"...","memberName":"...","message":"...","createdAt":0,"readAt":null}}`. Each member may send 10 reports per 15 minutes, enforced in the existing persistent rate-limit table. This does not send email or other external messages.

Only the stored administrator named Shawn (case-normalized) can `GET /api/reports` or `PATCH /api/reports`. Both return `{"reports":[...]}`. The inbox contains at most 200 entries, unread first, newest first within each state. PATCH accepts exactly `{"reportIds":["..."]}`, up to 100 unique generated report IDs. Empty lists are valid. Marking a report read preserves the first read timestamp and is idempotent; unknown valid IDs have no effect. Read updates are limited to 120 requests per minute.

## Registered members

Only the stored administrator named Shawn can `GET /api/members`. It returns `{"members":[{"id":"...","name":"...","role":"member","createdAt":0,"categoryIds":[],"draftVoteIds":[],"submittedVoteIds":[],"favoriteIds":[]}]}`. Registered administrators are included. Empty preference/favorite lists are explicit. Hidden activities are omitted from vote and favorite lists. Password hashes, name keys and session data are never selected or returned. Sun and ordinary members cannot read this list or the report inbox.

## Inline host reviews

Only stored administrators named Shawn or Sun can `PATCH /api/activities/:id/reviews`. The payload requires exactly these four fields, and the response is `{"reviews":{...same four normalized fields...}}`:

```json
{
  "shawn_comment": "A useful note.",
  "sun_comment": null,
  "shawn_rating": 5,
  "sun_rating": null
}
```

Comments are strings of up to 10,000 characters or null. Existing activity normalization trims comments and converts blank comments to null. Ratings are integers 1–5 or null. Only published activities can be edited. SQL updates only these four columns and `updated_at`; no card metadata can be overwritten through this endpoint. Reviews are limited to 60 saves per administrator per minute.

## Verification

`node --experimental-strip-types --test tests/trip-community.test.mjs` exercises real SQLite with the D1 adapter through public request handlers and actual session-cookie authentication. Coverage includes account isolation, permissions, unknown fields, invalid and oversized bodies, session expiry, report spam throttling, bounded inbox ordering, idempotent read timestamps/migration, hidden activities, and preservation of all unrelated activity columns during review edits. Factory/store seams are in `lib/trip-community.ts` and `lib/trip-community-store.ts`; route wrappers resolve the existing Workers D1 binding.
