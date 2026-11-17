# Voting countdown visual update

Reviewed 2026-11-16. The owner asked for a Doomsday-style digital countdown and total hours rather than days. The design interprets that as a dark instrument panel with pale green segmented numerals and HOURS / MINUTES / SECONDS labels. It uses original SVG geometry, with no movie artwork, trademark logo, external font or package.

Primary visual context: [Disney's official Avengers: Doomsday page](https://movies.disney.com/avengers-doomsday) presents green illuminated campaign imagery; [Disney+'s official Countdown to Doomsday article](https://www.disneyplus.com/explore/articles/countdown-to-avengers-doomsday) establishes the campaign. The small website panel is an interpretation, not a pixel reproduction of a specific video frame.

`remainingTime` preserves the deadline and expired state; its `hours` is now total remaining hours. `days` remains only for compatibility/internal data and is not part of the display. `formatCountdown` produces `1452:00:01`, with no rollover at 24 hours.

`AnimatedCountdown` keeps the existing clock owner and only animates changed numeral wrappers for 160 ms. Its SVG segments are static; there is no glow loop, new RAF, new interval or extra canvas. Accessible `time` exposes the complete value; the decorative numerals and unit labels are aria-hidden. Existing active/hidden/reduced-motion cancellation remains.

The panel is approximately 215 px wide × 63 px high for four hour digits at its normal 32 px numeral height. The short-viewport variant uses 25 px numerals and approximately 180 px × 47 px. Exact layout/contrast and physical-device performance remain for parent browser QA. Seven focused calculation/SSR tests, targeted lint and TypeScript passed.
