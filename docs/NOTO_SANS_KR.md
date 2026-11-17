# Noto Sans KR and vote display helpers

Prepared on 2026-11-16 for the user's requested Noto Sans KR typography. The font source is [Google Fonts' Noto Sans KR specimen](https://fonts.google.com/noto/specimen/Noto+Sans+KR) and its [official CSS API](https://fonts.googleapis.com/css2?family=Noto+Sans+KR:wght@100..900&display=swap). Font assets were fetched from Google's `fonts.gstatic.com` version `v40`, without modifying the font binaries.

## Local font assets

- Stylesheet: `public/trip/fonts/noto-sans-kr.css` (84,895 bytes including the local provenance comment).
- Font payload: 124 variable WOFF2 subsets, **3,507,740 bytes** in total.
- Latin subset: `public/trip/fonts/noto-sans-kr-latin.woff2`, **25,880 bytes**; SHA-256 `6ecf7205a09aea30481edc34156d1beba7be11f72d03e80bdb6bbf592594ba15`.
- Other subsets: `noto-sans-kr-000.woff2` through `noto-sans-kr-122.woff2`.
- License: `public/trip/fonts/OFL-NotoSansKR.txt`, copied from the [Google Fonts repository](https://raw.githubusercontent.com/google/fonts/main/ofl/notosanskr/OFL.txt). The font is distributed under SIL Open Font License 1.1.

The official CSS's Unicode ranges and normal variable weight range **100–900** are preserved. Coverage includes Latin, full Hangul syllables, Korean jamo, Hanja/CJK characters and the other ranges supplied by Google. Browsers download only the subsets needed for visible text; the full 3.5 MB is the installed asset total, not the required Latin page transfer. The existing self-only font CSP can remain unchanged.

Integrate the stylesheet through `sitePath('/trip/fonts/noto-sans-kr.css')`. Its font URLs are relative, so both `/trip/fonts/` in development and `/ktravel/trip/fonts/` in production work. An optional Latin preload should use `sitePath('/trip/fonts/noto-sans-kr-latin.woff2')`, `as="font"`, `type="font/woff2"` and `crossOrigin="anonymous"`.

Set the canonical font family to `'Noto Sans KR', sans-serif` and remove the old Geist, Georgia and other display-face overrides from all shipped UI callers, including the admin form. This preparation task supplies the assets; layout, typography application, browser font verification and registry updates belong to the integrating UI change.

## Vote and distance helpers

`lib/vote-planning.ts` exports:

- `MAX_VOTES = 20` for all selection limits and counters.
- `VOTE_DEADLINE_ISO = '2027-01-16T04:59:59Z'`: the parent's stated assumption of **2027-01-15 23:59:59 America/New_York** (EST, UTC−05:00). This does not use the viewer's browser timezone to reinterpret the deadline.
- `remainingTime(nowMs)`: whole days, hours, minutes and seconds, plus `expired`; remaining partial seconds round up and the result stops at zero at/after the deadline. The UI owns the one-second timer and visibility cleanup.
- `formatDistance(meters)`: one shared metre value formatted as kilometres and miles, with at most one decimal place. One mile is exactly **1,609.344 metres**. For example, `12,361` metres displays `12.4 km · 7.7 mi`.

Focused verification: `node --experimental-strip-types --test tests/vote-planning.test.mjs`. Four tests check the stated deadline/20-pick limit, second/minute rollover and expiry, independent distance examples, and every local WOFF2 reference/header/length plus representative Latin and Hangul coverage. Targeted lint passes. No timer, new dependency, UI component, database write, registry or deployment change was made in this preparation task.
