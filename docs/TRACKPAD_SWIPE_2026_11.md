# One card per trackpad gesture — 2026-11-16

> The unconditional quiet-only reset below is historical. Local v0.3.2 adds bounded fresh-burst detection; see the final section.

## Reproduction

The carousel's existing inline React `onWheel` handler was executed directly against one deterministic wheel-only stream, without pointer or keyboard events:

| Timestamp(ms) | Dominant horizontal delta |
| --- | --- |
|1000|90|
|1100|70|
|1200|55|
|1300|40|
|1400|28|
|1500|20|
|1600|9|
|1700|3|

The current-handler replay returned `[1,1]` and failed `assert.equal(moves.length,1)` with `2 !== 1`. The450mscooldown measured time since the last accepted navigation. The same gesture's momentum continued beyond450ms and was accepted as another navigation. Axis reversal and pointer/wheel duplication were considered but were not required: the failing stream used one axis, one direction and wheel events only.

## Fix

`lib/carousel-wheel.ts` owns the gesture decision used by the existing `.cards` React wheel handler. It latches after the first qualifying dominant-axis event. It rearms only after250mswithout any wheel event; even tiny momentum events extend the current gesture. The existing18-unitthreshold and direction convention remain. There is no timer, RAF, observer, dependency or global wheel listener.

The listener remains attached only to the carousel, with the same React/passive/default behavior. No preventDefault/stopPropagation or listener option was added. Expanded detail panels remain outside that listener and keep native scrolling. Pointer drag, keyboard movement, login/visitor restrictions, camera state and carousel index clamping were not changed.

## Verification

The original continuous-stream regression now returns `[1]`. Three focused public-helper tests cover long momentum, tiny-tail events, a later new gesture after silence, initial threshold, dominant axis and direction changes within one gesture. Run:

```sh
node --experimental-strip-types --test tests/carousel-wheel.test.mjs
```

Scoped lint, TypeScript, prototype smoke and diff checks pass. The smoke check now verifies the shared gesture decoder is wired into the explorer; dominant-axis behavior is exercised by the public-helper tests instead of matching an inline implementation expression. The existing UI registry gate was checked; concurrent parent layout changes and this new helper require parent-reviewed fingerprint/support registration before final gates.

No active user browser was operated. Native MacBook hardware momentum, touch/keyboard regression and visible expanded-panel scrolling remain for parent/user browser verification. Standard wheel events do not expose a portable physical gesture phase;250msquiet is the deliberate event-stream boundary.

The final actual-inline-handler replay (not a copied handler) returned `[1,-1]`: one move for the same1000–1700msmomentum stream, then one backward move for a fresh2200msgesture. It passed both assertions without a browser or a timer.


Parent visible local QA: three separate native browser scroll actions movedSamwon→Hanilkwan→KoreaHouse→Hanilkwan, exactlyoneperaction. ArrowRight then movedHanilkwan→KoreaHouseandfocusedthecorrectcard. Card client/scrollheights matched for all5mountedcards; document scrollTop=0andheight720/viewport720. This verifies the actual mounted React handler for browser wheel actions; a physical two-finger hardware recording remains unavailable. No media/network or map-render resource was added by the decoder.


Public verification after release: a freshvisitorvisit at the share-queryURL showedSamwonGardenfocused; one native browser scroll selectedHanilkwanApgujeongMainBranchand no secondcard. Document scroll remained0(height720/viewport720); one canvas retained10buffers/fiveprograms/fourtextures. The new wheel gate added no recurring resource. Full173tests, registry, lint, TypeScript and release asset gates passed.


## Small-packet and native-scroll correction

Further owner evidence: mousewheelworks, MacBooktwo-fingerverticalswipesareinconsistentandcardcontentsmovevertically. A gentle[4,5,5,5,3,2]pixelstream at16msintervals reproducedzero navigation against an expectedone; the earlier one-packet18threshold missed slow trackpad gestures. The recognizer now accumulates signedX/Y displacement within the samequiet-gapgesture. Large mouse packets retain immediate response, one move remains latched, and even tiny tails extend the gesture until250msquiet.

The collapsedcardalsohad`overflow-y:auto`, and`.cards`allowednativepan-y. Removed only that collapsed-card scrolling. A native non-passive wheel listener belongs to the actual carousel DOM node via a stable React19callbackref, cancels ordinarywheeldefault, and is removed on detach; Ctrl-pinch remains native. The existing React wheel decision now skipsCtrl-pinch. Touch handling allows nativepinchzoom while custom horizontal drag remains; document overscroll is disabled. Expanded detail/login/drawer scroll panes retain their native verticalscrolling. No globalwheel listener or repeatingtimer/RAF.

Nine focusedEventTarget/gesture tests cover cancellation, pinch exemption, separate detail targets, repeatedattach/dispose, small fractional positive/negative packets, signed diagonal motion, quiet reset and long inertia. Local390×844browser scroll movedSamwon→Hanilkwanwhile all card/document scrollTop values remainedzero and collapsedoverflowYwas hidden.

## Stationary cursor rearming — local v0.3.2

A later report described one two-finger swipe working, then another at the same pointer location failing until pointer movement. The decoder never reads pointer movement. We reproduced the narrower concrete fault: tiny momentum packets keep refreshing `lastEvent`, so genuine new stroke peaks were returned as zero forever unless the entire stream went silent for 250 ms. New horizontal/vertical bursts `[4,5,6,5,3,1]`, separated by 1 px tail packets, produced only `[1]` when four card advances were expected. Strong reverse swipes also failed. Four focused assertions were red before the change.

Only the shared decoder changed. After a 220 ms guard from the last accepted movement, a renewed acceleration or meaningful reversal can start a new displacement window. Small renewed strokes need a stable/increasing follow-up and must reach the existing 18-unit threshold within 120 ms. A decaying rebound cancels that window. Ordinary decaying momentum remains one gesture, and 250 ms of complete silence still resets it. No mouse movement, timer, listener, observer, animation, dependency or global input owner was added. Mouse-wheel, pinch, pointer-drag and keyboard owners remain unchanged.

Fourteen focused tests cover gentle horizontal/vertical renewal while tails continue, strong reversal, early jitter, decaying rebounds, expired/unfinished strokes, long inertia, threshold/axis behavior (including decaying diagonal axis changes), pinch/default scrolling and repeated listener disposal. A fixed 100,000-packet loop accepted exactly 1,000 deliberate strokes in 2.15 ms on the Node host; this establishes bounded decoder work, not hardware input latency.

Local Chrome automation delivered consecutive same-coordinate wheel actions, with native cancellation and current focused-card updates. The tool injects a pointermove for each scroll action, so those actions do **not** prove physical stationary-cursor trackpad recovery. The native macOS surface was locked; physical two-finger packet capture and Safari remain unverified. A temporary capture confirmed the prior same-coordinate browser packets reached both document and actual React handler; the capture and diagnostic attributes were removed. These limits are explicit rather than treating synthetic input as native phase evidence.

Changed files: `lib/carousel-wheel.ts`, `tests/carousel-wheel.test.mjs`, version files, product/registry records and this document. No public build/deployment or database change was made. Final combined gates and browser screenshot are recorded at integration.

Final v0.3.2 gates: 282 tests pass with zero failures/skips, including all 14 gesture cases; lint, TypeScript, diff and component registry pass. The refreshed code graph has 1,404 nodes / 3,125 edges; CSS/assets and missing SQL-parser/test-symbol extraction remain index gaps covered by direct review and executable tests. A review caught and fixed cross-axis sign confusion with a red/green decaying-diagonal trace and its transpose. The final fresh local browser has no warning/error logs, advances the focused card, preserves ArrowRight/reverse wheel behavior, keeps the document scroll offset at zero and mounts at most five cards. Version evidence: [local carousel](../.impeccable/review/swipe-v0.3.2.jpg). Appearance and renderer resources are unchanged; the screenshot does not prove physical gesture recognition.
