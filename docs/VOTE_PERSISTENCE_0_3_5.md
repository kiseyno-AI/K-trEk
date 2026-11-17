# Submitted votes — v0.3.5

The existing `trip_member_preferences` D1 row now owns each member’s confirmed ballot. No new dependency, table or migration is needed. Favorites and unrelated preferences retain their current owners.

## Behavior

- Submit/Update vote awaits the server’s persisted response; a failed request retains the draft and offers retry. Busy submission disables edits and duplicate clicks.
- A fresh session restores confirmed votes from D1. Browser storage is only a draft cache, never proof of submission.
- Ordinary preference sync cannot overwrite or erase confirmed votes. An explicit resubmission replaces the same member’s ballot, so totals do not count duplicates.
- Server validation enforces published IDs, unique selections, 1–20 choices, current session ownership and the January 15, 2027 Eastern deadline.
- Shawn and Sun administrators open **Votes** in the header for activity totals and each member’s submitted selections. This read-only projection exposes no draft, category, favorite, report, credential or session fields. The full member list and reports remain Shawn-only.
- Old browser-only submissions need a participant to refresh and submit again; there is no central copy to migrate.

## Verification

The full local suite passes 302 tests, plus lint, TypeScript and registry checks. Focused regressions exercise real SQLite through authenticated handlers, atomic ballot preservation, confirmation/failure retry, deadline and access limits, and dialog loading/error/abort/focus behavior.

Browser QA used an isolated D1 and synthetic identities, without changing real host passwords or member data. At 1440×900, a member selected an activity, submitted it, refreshed, and saw the server-confirmed ballot restored. Separate API sessions changed a ballot and performed a stale ordinary sync; the submitted choices remained intact. Both Sun’s and Shawn’s dialogs correctly showed 2 members, 3 selections and a shared activity with 2 votes. An ordinary member received 403 for group results. Escape restored focus to Votes. The native modal also fit 390×844 with no page or dialog horizontal overflow.

Resource ownership: the added dialog has no animation, polling or frame owner. Two opens produced exactly two vote-result reads. It uses the existing eight-second request deadline and aborts on close/unmount; lifecycle regressions cover ignored late responses. Camera, countdown and production Voice gates are unchanged. The production build also passed, and the local source graph was refreshed. This verifies the added request owner, not a fresh whole-site animation benchmark. Physical phone hardware was not tested.

The existing cream/teal native dialog, Noto Sans KR and controls are reused. Screenshots were visually inspected at desktop and mobile widths; no new visual pattern was installed.
