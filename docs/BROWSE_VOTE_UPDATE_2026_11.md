# Browse, voting and regional activities — 2026-11-16

## Requested behavior

- The first card reveal now waits for the actual Korea camera arrival and the existing minimum intro. The existing finite owner brings nearby cards in from beyond the right viewport edge, with an 820 ms flight and 95 ms stagger. Return navigation uses the same arrival/reveal sequence.
- The deadline remains January 15, 2027 at 23:59:59 New York time. Its original segmented SVG clock shows total hours, minutes and seconds, with no day counter. The clock and Review vote button are centered in a compact footer.
- Front cards show city/district, a category badge, a high-contrast heart and Details. Voting happens only inside detail; the Vote/Voted control is placed near the title/description. No unknown-travel-time badge or draft-selection button remains on front cards.
- Successful travel results omit the traffic disclaimer and duplicate Seoul Station → destination sentence. The Google unverified-data paragraph is removed. Provider failures and route loading still have honest status messages.
- Booking, Google Maps and YouTube actions include locally served icons; the existing visible labels remain accessible.
- Each expanded card has a Shawn and Sun review list with five-star rating displays and comment text or an honest empty state. Admin has separate optional 1–5 rating selectors and comment fields with two/three-sentence guidance. Comments and ratings were not fabricated.

## Data and preservation

Migration `0004_host_reviews_and_card_location.sql` adds only three nullable columns to the existing activities table: two host ratings and compact card location. Existing rows and timestamps are preserved. The DB was backed up to `.wrangler/backups/before-host-reviews-2026-11.sqlite`.

All 75 preexisting published card locations were populated with compact city/district labels. Seoul districts come from the same existing SGIS-derived geometry and verified venue coordinates used by the map, with full region/address fields retained. The editor can maintain the compact label for future places.

Fifteen existing food cards now use the named restaurant's menu photograph. Nine additional regional candidates add three nature visits, three experiences and three restaurants: Garden of Morning Calm, Nami Island, Pocheon Art Valley, Gwangmyeong Cave, Gangchon Gimyujeong Railbike, Yeongjong Seaside Railbike, Bonsuwon Galbi, Chuncheon Tongnamujip Dakgalbi and Sinseung Banjeom Incheon. Nami's driving destination is the mainland wharf and its ferry transfer is explained in the record.

There are 87 stored rows, including three hidden illustrative samples, and 84 published cards / 18 food cards. All published photo URLs now point to controlled local files. Eight unchanged clinic subjects were also localized and optimized with the already-installed Sharp: 7,534,390 → 323,822 bytes. No dependency was installed. Existing fields outside the explicitly updated photo fields were compared against the pre-change snapshot with zero unexpected changes.

Photo rights remain honest: 39 published assignments are licensed and 45 are official references whose reuse permission has not been confirmed. Local storage does not confer a license. Source links, watermarks and credits are retained.

## Verification record

125 tests pass, including existing import/coordinate/translation preservation, the additive rating migration, 1–5 validation, total-hour rollover, menu-photo and regional imports. Historical schema tests continue to use their real historical columns; current import fixtures apply the new migration. Lint and TypeScript checks are part of the final release gates.

Actual local HTTP create/update/admin-read tests persisted both ratings and two-sentence comments, rejected a rating of six, and kept an unpublished fixture out of the public reader. The temporary fixture was removed. No real host comment was altered.

At 1280×720, Details is fully inside the card and the Vote button center is x640. At 390×844, the clock and Vote center are x195 and Details is clear. At 320×568, the clock/Vote center is x160, Details ends at y418.88 inside a card ending y427, and the document stays exactly 320×568. The entry owner also pauses new animations created while hidden; the star group has an explicit accessible image role and rating label.

The public release completed with matching server/assets. The real HTTP gate passed all 18 CSS/JS assets on both the local public worker and shawnai.win. All 84 published images returned HTTP 200, image MIME types and byte hashes matching their controlled local files. The public admin and privileged reader remain HTTP 403; the new build contains zero matches for the configured secret values.

Public browser QA confirmed Details → Vote/Voted → Vote, restoring an empty draft afterward; all three Samwon link icons loaded; both accessible review rows report “Not rated yet.” A separate local admin tab confirmed optional 1–5 selectors and comment textareas without changing a real record. Actual drive/taxi/subway/bus results still load; removed disclaimer and unknown-rating/travel paragraphs are absent.

The full public intro was sampled: cards remain absent through orbit/flight. After camera phase Korea, the focused card enters at x1323 (beyond the 1280 px viewport) with translate 878 px, then moves through x712, 523, 468 and 453 to x450. Two complete detail/return cycles end ready with one canvas, 10 buffers, five programs and four textures, matching the baseline. At 390×844 with reduced motion, 1.122 seconds produced zero ambient draws and zero running animations while the clock remained readable.

Graphify refreshed locally to 1,093 nodes / 2,305 edges. Its CSS/font classification and absent SQL parser remain index gaps, covered here by direct source review, registry verification and migration tests. The Impeccable source scan found zero failures and one existing icon-press easing advisory; it does not establish live contrast or physical-device performance. The only inspected console error is the existing optional Cloudflare analytics beacon blocked by CSP.

## Main files

`app/activity-explorer.tsx`, `app/globals.css`, `app/animated-countdown.tsx`, its CSS module, `lib/vote-planning.ts`, `lib/activities.ts`, `app/admin/activity-editor.tsx`, the additive migration, host-review tests, data manifests/importers, local photos/icons, `ui-components.json` and `docs/UI_COMPONENTS.md`.

No new animation loop, map renderer, runtime photo provider, database table or package was added. The clock keeps its existing 1 Hz owner; map/camera/road rendering is unchanged. Physical phone GPU/battery, long-session heap profiling and actual hidden-state timing where the in-app host does not expose visibility remain measurement gaps.

Final settled-detail sample: 13 draws / 1.125 s, 0.30 ms maximum sampled synchronous submission; no temporary morph layers. Final return ended ready, with an empty vote draft, one canvas and zero temporary layers. Lint, TypeScript, production build, registry and public CSS/JS gates passed. The updated public browse screenshot is `.impeccable/review/ktravel-browse-vote.webp`. No new package or animation/render owner was introduced.
