# Production Voice off — v0.3.4

The owner requested publishing the current trip site with Voice hidden and all related work disabled. `localTripVoiceAvailable` now returns false immediately in production, before inspecting the host. Development retains the existing explicit loopback host rule.

The home page uses this shared gate for `voiceEnabled`. The explorer's existing conditional therefore never mounts `TripVoiceHost` in production. Audio playback, assistant/voice fetches, interaction recording, voice heartbeats, listeners and dialogue state are owned inside that component/hook and are never created when it is absent. Favorites, votes, directions and member preferences retain their separate owners.

The actual `/api/voice` wrapper and `/api/assistant` handler use the same gate before authentication, database/configuration access or provider work. Direct requests to the production Worker on localhost and forwarded-host overrides are denied as well as ordinary public requests. No provider key or runtime secret needs to be removed to preserve local testing.

## Verification

The production loopback test failed before the one-line shared guard and passed afterward. An explorer ownership regression proves that a disabled Voice surface creates zero audio-player or interaction-client instances through card opening, voting and countdown updates. Existing enabled-Voice ownership tests still pass. Public release QA must also verify no button, no assistant/voice/media requests during browsing, direct endpoint404 responses and local development Voice availability.

No visual redesign, animation owner or provider dependency was added. Production omits the existing component and its resources rather than hiding it with CSS. The source gate, callers and wrapper entry points were reviewed directly and through the local graph. Physical-phone audio/GPU behavior is not part of this release test because public Voice is disabled.

## Release integration

The current production state predates the preferences/report tables in migration `0006_trip_community.sql`. This release applies only that append-only community migration after a private SQLite backup; assistant migration0007is unnecessary while the feature is disabled. Existing account/password/session/favorite data is preserved. Public proxy integration for preferences, reports, member administration and inline reviews is reviewed separately in the private Observatory repository; assistant/voice routes remain blocked.

Publication uses the original `/Users/shawn/korea-nyc-events` checkout and its existing rollback-capable release helper. The feature preview remains in `/Users/shawn/ktravel-review`. Source changes pass PR checks and are merged before release. A merge alone does not publish the site.
