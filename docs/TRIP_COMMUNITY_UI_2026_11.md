# Local member reports and preference UI

## Owned surfaces

- `app/trip-community.tsx` exports `ReportComposer`, `CommunityControls` and `useMemberPreferences`.
- `app/trip-community.module.css` keeps native forms/dialogs in the existing cream/dark Noto Sans KR palette.
- `lib/trip-community-client.ts` owns bounded authenticated JSON requests and the member preference synchronization lifecycle.
- `tests/trip-community-client.test.mjs` exercises the public request/synchronization interface.

No dependency, database mutation, public deployment or shared explorer/registry edit was performed in this lane. The parent supplies authenticated identity, placement, local-DB configuration and final rendered QA.

## Parent integration

Render `ReportComposer key={user.id} user={user} onSessionExpired={expireSession}` directly above Sign out in the account menu. The form allows1–2000trimmed characters; it preserves text on failure, clears only after successful POST and aborts on disposal.

Render `CommunityControls user={user} activities={activities} ready={!intro} onSessionExpired={expireSession}` in the signed-in header or account controls. Only normalized Shawn with adminrole mounts the actual controls and data reads. Its first successful report read after readiness automatically opens a popup if unread reports exist, once per mounted identity. Manual Reports/Members openings refresh their respective snapshots; there is no poller. Dismissal keeps unread reports; Mark as read updates the server. The backend remains the authorization authority.

The canonical native dialog supplies top-layer focus containment and native keyboard behavior. Escape cancels through state and cannot close an underlying activity detail. Native close events are deliberately not used as state triggers, avoiding a late close event dismissing a newly reopened dialog. Explicit close restores the relevant trigger after the dialog has closed. Long content scrolls only in the dialog pane; there is no animated or global body-scroll owner.

Use `useMemberPreferences({user,hydrated,draftVoteIds,submittedVoteIds,onRestore,onSessionExpired})`, where hydrated is true only when the locally loaded vote owner matches the current user.id. onRestore must be stable and update both the UI and its account-scoped localStorage keys. The hook returns `recordCategory(id)`, `flushPreferences()` and `syncError`. Call recordCategory on explicit non-all category clicks. Await flushPreferences BEFORE deleting the session on sign out so a last click in the debounce window is not discarded. Display syncError using the existing account notice.

## Synchronization rules

GET precedes PUT. Existing server votes restore once; an absent row seeds existing browser votes. Explicit user actions made while the first read is pending take precedence, and selected category IDs merge uniquely. There is one300msfinite debounce and at most one active write; a later changed snapshot supersedes intermediate queued writes. A failed initial read never writes an unverified snapshot over existing server choices and retries only after another explicit action. Requests have8second deadlines and shared identity-abort ownership. Disposal cancels queued timers/requests and suppresses late callbacks. No activity browsing/click history, microphone, analytics, extra favorite persistence or background poller is added.

## Verification

The first stored-choice restore test failed against the empty owner, then passed. Serialization and during-read precedence tests were red before their implementation. A later pending-write flush regression caught an overwritten in-flight promise reference and passed after keeping the real write owner. Eight focused tests now pass, covering restore-before-write, bounded request timeout/401, failed-read preservation/retry, malformed payloads, serialization/latest-wins, logout flushing, tiny debounce races, category deduplication and disposal. Scoped lint and TypeScript accompany the tests.

Parent must verify actual browser report submission, Shawn auto popup, mark-read, member names/preferences, native dialog Escape/focus restore and narrow-screen overflow after local integration. The API report inbox is bounded to its latest200unread-first items; Mark as read handles100peraction. A hard browser/process termination can still interrupt an unsent network write; existing account-scoped browser vote storage remains available.
