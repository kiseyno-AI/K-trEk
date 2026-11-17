# Mobile startup resilience — 2026-11-16

The owner reports a globe-first-screen stall on AndroidChrome. A desktopChrome390×844DPR3mobile/touch emulation with4×CPUthrottleandSlow4Gloaded the originalpublicpage successfully: intro-complete,HiClusterElogin,canvasphaseKorea. Geometry/texture loads took roughly2–10s and initialsessionGET642ms. This does not reproduce the owner's physical AndroidGPU/browser failure.

Separate concrete startup gaps were reproduced: synchronousshader/observerinitialization throws could escape before readiness and interrupt passiveeffects; initialsession lookup had no deadline. A public-helper regression for a stalledsession failedfalse!==true at6000ms before the fix. `lib/trip-session.ts` now bounds that read to6s, aborts the nativefetch, returns the login state on error, and clears timer/listener ownership on success/disposal. Existing server sessions and DBdata are untouched. Two focusedtests cover timeout, real sessions, backenderrors and external disposal.

Renderer startup protections and final public verification follow below. No default light counts, textureprecision orDPR cuts are made.


## Public verification after release

All191tests, lint, TypeScript, registry(7families/46reviewed sources)anddiffchecks passed. Release verified18CSS/JS assets on the local Worker and public host; sharing metadata/image checks still pass. The public voice control remains hidden and no account/DB state was changed.

Actual public browser fault injection at390×844DPR3:

- Throwing from native shader compilation on initial load producedrenderer=unavailable/startupFailure=initialization, but the page reachedintro-complete,HiClusterEandthefirst-nameinput. Parentstartup was not aborted.
- A GETsessionpromise held until its AbortSignal fired, under4×CPU/Slow4G, was aborted by the newdeadline and also reachedHiClusterE/input; the normally loaded renderer remainedreadywithunchanged12492/12000lights,10buffers/fiveprograms/fourtextures.
- NativeWEBGL_lose_contextafterreadiness producedcontext-lostfallback, kept the login usable, stoppedanimation/twinkle and left the drawcounterunchanged across two1.2secondchecks.
- Fault-injection scripts and throttles were removed, then a normal390×844DPR3reload reachedHiClusterEwithrendererready/phaseKoreaandtheunchangedGPUresource/lightcounts. This was a lab browser, not the owner's physical Androiddevice.

Visible public390×844QA followedthe8.5secondintro→nameform→visitorcards. One ordinary nativebrowserverticalscroll movedSamwon→Hanilkwanexactlyonce; card/document scrollTopallremainedzero, collapsedoverflowY=hidden. Local320×568long-titlecardsfitwithclientHeight==scrollHeight. All temporaryviewport/CPU/networkoverrides were reset.

Changed surfaces:`app/activity-explorer.tsx`,`app/globals.css`,`lib/carousel-wheel.ts`,`lib/trip-session.ts`,`app/planet-canvas.tsx`,their3focusedtestfilesandregistry/reports. The implementation removes nested collapsed-card scrolling, reuses one nativewheelowner and the existing renderer/camera, adds only finite request/startupdeadlines and cleanup; no dependency added. SeeMOBILE_CANVAS_STARTUP_2026_11.mdforcontrolledresourcecoverage andTRACKPAD_SWIPE_2026_11.mdforinputtraces.

Graph refreshed1242nodes/2687edges. OptionalSQL/CSS/font extraction remainsunavailable; the twoimperativeinput/sessiontestfiles yieldnoGraphifysymbols and were run/reviewed directly. PhysicalAndroidGPU/driverbehavior and actualMacBookfinger-eventcaptures remainunverified. Screenshot:`.impeccable/review/ktravel-mobile-entry-fixed.webp`.
