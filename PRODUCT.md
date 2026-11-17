# Product

<!-- impeccable:product-schema 1 -->

## Platform

web

## Users

Adult friends choosing activities for a shared Korea trip. Shawn and Sun curate options and add personal context.

## Product Purpose

Help a group discover Korean activities, understand travel effort from Seoul, save possibilities, and assemble a personal vote draft before the trip is planned.

## Positioning

Activities live in one cinematic map-and-card space: moving between cards, destinations, route overviews, details, and voting should feel like exploring one place rather than switching tools.

## Operating Context

The first release is a visual and interaction prototype. It uses114published candidates, including32Food and3Nightlife cards, and account-owned draft preferences and D1-backed submitted ballots. Public UI labels and editorial text are English. Original Korean identity fields remain internal for matching and source traceability. Travel dates and group size are not yet set.

## Capabilities and Constraints

- Keep one continuous globe camera from orbit to Korea and activity detail. Use 12,492 warm lights with individually varied size and brightness based on the earliest successful SVG’s ten city centers and density footprints, with 6,732 quieter irregular points spread across land and the rest emphasizing city hubs; a smooth eastern ridge stays darker. Geographic registration is approximate and disclosed; decorative cores stay bounded in screen pixels at close zoom. China and Japan have unlit silhouettes wherever they enter the current geographic frame. Selected endpoints use coral red. Details frame the actual Seoul Station main-line terminal and destination together, including nearby Seoul venues. Local detail adds real Han River water/island vectors and25district outlines, with English neighborhood labels. Kakao driving directions replace schematic connections when a server REST API key is configured; the current road, distance and travel estimate are fetched only for a selected card. Missing configuration, quota and provider failures never invent a route or time. A separate12,000-point local Seoul field uses actual city/river masks, bright Gangnam/Jongno hubs and softer surrounding urban footprints.
- Activity content comes from one D1 activities table, with114published candidates across eight categories. The original three illustrative samples remain hidden after import. The /admin form creates, edits and hides records. Separate source facts, planning suggestions, verification states, unknown values and sample-only map/photo data. All114published activities have sourced WGS84 pins, with named starting points for area visits and the mainland ferry wharf for Nami Island. Unknown driving time and host reviews remain empty. 113photographs show the named subject:39licensed assignments and74official references marked “Official website reference · reuse license unverified.” All published photographs are controlled local files; local storage does not imply reuse rights.31Food cards show their restaurant dishes; WIIRPhiladelphia retains an honest pending-photo placeholder until an exact operator menu photo is available. Captions and credits are English. The carousel mounts at most five nearby cards.
- Selecting a card carries its measured photo, cream surface and unscaled title/copy into the inset detail panel with an820msfinite transition. Photo cover crop is preserved; the destination appears only after matching photo bounds align, and moving copy is clipped to the visible interpolated card/panel bounds. Live detail paragraphs never scale. Temporary decorative layers are removed on finish or interruption. Returning waits for the actual Korea camera arrival before mounting cards, then reveals the nearby cards with a finite 820 ms flight from beyond the right viewport edge with a 95 ms stagger. Close-up lights use a bounded10–22pxbase and a small contrast lift while retaining individual variation. The page itself does not scroll; detail content scrolls inside a rounded panel with hidden scrollbar and bottom spacing.
- Support an approximately 8.5-second intro without a skip button, activity browsing, centered category badges, detail and route views, favorites, up to twenty draft selections, and database-confirmed submitted votes. Search and region controls are omitted.
- Save favorites in the database for the signed-in member. Cache vote drafts per account and sync them to D1. Submit votes explicitly to D1; show success only after the server confirms persistence. Shawn and Sun can view totals and each member’s ballot from Votes.
- Name-first membership uses a password and an HttpOnly server session. New names explicitly create an account; returning names enter their existing password. Shawn/Sun are reserved host names with administrator access to all card fields; the owner chooses each initial password through the normal first-visit form. Once set, later visits require that password. Visitors can browse with a ticking countdown; clicking a card opens login, and heart/vote/routes require membership. Verified public ratings and booking availability are later phases.
- Respect reduced motion and keep core controls keyboard accessible.

## Brand Commitments

Working name: “K-trEk, without Shawn & Sun.” The attached “out” letters are deliberately smaller but remain readable. The experience should be adult, cinematic, warm, and exploratory rather than a generic booking catalogue.

## Evidence on Hand

The functional specification is `/Users/shawn/Downloads/Korea_Trip_Functional_Spec.md`. The current 70 candidates retain the user’s supplied source evidence and uncertainties; English editorial translation does not imply new verification. Personal comments, verified ratings and travel times are not fabricated. Field-level evidence and verification state are retained in D1. The clinic photo source review is dated 2026-11-15; per-photo provenance and rights evidence are retained in the canonical photo manifest and the photo registers.

## Product Principles

- Keep map, card, route, and detail state visibly connected.
- Make travel effort legible before asking for a choice.
- Keep Favorite, Details and Vote as separate intentions.
- Prefer an honest approximate prototype over fabricated live data.
- Motion should explain state changes and never block reduced-motion users.

## Accessibility & Inclusion

Support keyboard navigation, visible focus, touch targets, readable contrast, reduced motion, and a functional mobile layout.


## Current travel and voting presentation

Production v0.3.5 keeps the entire Voice/chat assistant disabled through the shared production gate: no control, hook, audio/interaction owners or provider requests. Local loopback development retains Voice. See [public Voice off](docs/PUBLIC_VOICE_OFF_0_3_4.md).

All text uses self-hosted Noto Sans KR. Category navigation is centered in the same viewport frame as its title. Voting accepts20draft selections and closes at2027-01-15 23:59:59 America/New_York; a segmented digital countdown shows total hours, minutes and seconds, ticking once per second while the document is active, stops atzero, and preserves saved vote results. Public interface labels remain English.

In local v0.3.3, members can select Seoul Station, Jongno 1-ga (Jonggak Station meeting point), Sinchon Station (Line 2), Gangnam Station or Yangjae Station as Departure inside a card. Selection lasts for the current page visit, including other cards. Every change clears stale roads/totals, cancels superseded requests and fetches new driving/transit estimates; origin markers and the existing continuous camera use the same selected coordinates. A server-configured custom default remains available. [Departure verification](docs/DEPARTURE_SELECTION_0_3_3.md).

Selected driving roads use a bright4.4pxscreen-space ribbon with forward-moving ivory highlights; the existing geographic camera, buffer and12fpsambientowner remain, with a static reduced-motion route. FromSeoulStation lists driving distance/time, nullable taxi estimate, and actual subway/bus/mixed options. Every displayed distance has km/mi; provider data stays server-only and the map retains a source link. Restaurant stay suggestions are hidden, duplicate booking/group text is shown once, and Sources&verification contains links only including required linked photo credits.

Use npm run release:public for publication:matching server/assets, previous-generation static support, rollback on failure and an actual CSS/JS HTTP gate prevent the unstyled-page regression.


## Motion refinements

The first main heading enters once with440mswordsettles/55msstagger using unchangedNotoSansKR; category updates, voting ticks and return navigation do not replay it. Reduced-motion visits and preference changes mark that arrival complete. Enabled Favorite/Vote icons have a small200msnative press/release squash, with no successful feedback on disabled controls. The active card has one finite850msthin warm-gold edge sweep on hover/keyboardfocus. These are CSS/WAAPI adaptations inspired by freeSpaceUIpatterns, not copied shader/physics packages.

The existing 1 Hz deadline clock moves only changed segmented numeric glyphs for 160 ms, with a semantic time label and aria-hidden SVG visuals. It adds no timer/RAF; initial, length-change, inactive, hidden and reduced-motion values remain immediately readable. No new WebGL resource or dependency is added.


## Browse and host reviews

The first card reveal waits for both the intro minimum and actual Korea camera arrival, then flies the nearby cards in from the right. Front cards show compact city/district locations, category badges, visible hearts and Details; expanded cards offer Vote near the title. The footer clock and Review vote action share the viewport center. Each detail has Shawn and Sun review rows with optional 1–5 stars and two/three-sentence comments, maintained in the existing admin form. Empty reviews stay visibly empty. Booking, Maps and YouTube links use local brand icons. Unknown travel badges and redundant provider/verification sentences are omitted.


## Transport selection and departures

The existing travel list offers native selectable Drive, Bus, Subway and Subway + bus rows. Drive includes the taxi estimate and any tolls. The map shows only the selected option's actual provider geometry, with cyan bus, violet subway and quieter gray walking segments, plus a text legend. Invalid or missing transit geometry clears the selected path and shows an unavailable status without inventing a road. Selection uses the existing response without another provider request.

Back sends the detail panel rightward before the camera returns to Korea. Category changes send the current cards rightward before new cards enter. Rapid choices retain the latest requested category, completing an in-progress entrance or morph before departure; reduced motion settles immediately through the same completion owner. The Review vote count badge sizes to its text plus horizontal padding.


## Shared departure and broader geography

The server-configured departure defaults to Seoul Station. Its name/WGS84 coordinates flow through directions, camera fitting, endpoint labels and the page; routes from a mismatched origin are rejected. No departure picker is added. Route-aware labels score finite in-frame placements against the actual polyline, pins, each other and the detail panel. Sixteen province-level boundaries remain visible at country scale;230city/gu areas outside Seoul fade in at regional detail, alongside the existing25Seoul districts. KTX candidates are planning suggestions; dated services and last-mile travel are unverified.


## Sharing and wheel gestures

Sharing metadata identifieshttps://shawnai.win/ktraveland uses its existing Korea-at-nightPNG; the obsoleteNYCOpenGraphimage was removed. One qualifying carousel wheel event latches the current gesture. A fresh deliberate burst can rearm before the previous tiny momentum tail stops; 250 ms of complete quiet also resets the gesture. Decaying momentum stays latched. Pointer and keyboard controls retain their existing owners; no timer or frame loop is added.


## Mobile entry and trackpad ownership

Trackpad packets accumulate signed displacement before choosing one card. Fresh stationary-cursor bursts and meaningful reverse swipes rearm after the short movement guard, independently of pointer motion; small decaying rebounds cannot accumulate indefinitely into another card. Collapsed cards clip their surface and never scroll internally. A carousel-owned non-passive listener cancels ordinarywheeldefault and is disposed with its DOM node; Ctrl-pinch/nativepinchzoom and expanded-panel verticalscroll remain available. Initialsessionread uses a6second request deadline and returns the login state on failure. A renderer-only18secondstartupdeadline and containedGL/asset/contextfailures release readiness without interrupting the first-login flow; normal camera quality, lights, textures andDPR remain unchanged.
