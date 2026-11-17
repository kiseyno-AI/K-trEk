# Supplied activity import

`data/activities-70.json` contains the 70 places and experiences supplied in the chat: 10 each in `food`, `history`, `culture`, `nature`, `experience`, `shopping` and `wellness`. Stable IDs combine the category with a readable place slug. The three previous illustrative samples remain stored but are unpublished.

Run from the project root with the existing dependencies installed:

```sh
npm run db:setup
node --experimental-strip-types scripts/import-activities.mjs
```

Both commands use the **local** `DB` binding in `db/wrangler.local.jsonc`, persisted under `.wrangler/state`. They do not operate on a remote database. Setup now uses Wrangler's migration tracking: `0001` is safe for the already-created table, then `0002_history_and_photo_credits.sql` expands the category constraint and adds nullable photo caption/attribution fields. The rebuild explicitly copies every existing column, including timestamps. `activities` remains the only application data table; D1 keeps its own metadata and migration tables.

The importer validates all records with the same parser as the admin page, requires 70 unique IDs and 10 records per supplied category, then uses `INSERT OR IGNORE`. Rerunning it preserves existing records, publication changes, comments and photo edits. It only hides the old `temple`, `seoul` and `busan` rows when they are still marked illustrative. Importing corrected source data under an existing ID requires an intentional edit through the admin page; this script does not silently replace it.

The cards are real destination candidates, rather than illustrative sample records, but the source research is **user supplied and was not independently rechecked during import**. Original URLs, branch distinctions, group conditions, date uncertainty, planned stay ranges and qualifications remain in each record. In particular:

- All booking statuses remain `unknown`; no trip date or booking was confirmed.
- Clinics have no invented stay duration. Their named clinician credentials and language support are attributed to the supplied research, pending independent verification; the cards do not certify clinicians or recommend treatments.
- Planning duration and operator duration are separate. The supplied Gugak performance is 80 minutes; Ongo's program is approximately 180 minutes. DMZ's suggested 360–480 minutes includes Seoul travel, while BRANME's 120–180 minutes is tentative.
- All70 venue/site coordinates are now sourced and verified against map features or branch/address POIs;16 area pins identify named starting points. Code-map coordinates remain null because the renderer projects WGS84 directly. Driving times, ratings, review counts, Place IDs, personal host comments and global `checked_at` remain null. See ACTIVITY_COORDINATES.md.
- Google Maps and YouTube search links are generated navigation aids. Actual YouTube video lists are empty; a search result is not represented as an actual related video.
- Source pages are photo references, not grants of reuse rights. Base image fields are null. The separate photo manifest/import adds licensed local assets, contextual captions and attribution. Displayed local images must match `/trip/photos/[a-z0-9-]+.(webp|jpg|png)`; unrelated relative paths remain invalid.
- The numeric capacity is the supplied room/program maximum only where stated (Samwon Garden/Bicena rooms 12, Ongo program 100, BRANME Blue program 10). The group notes retain that scope; it does not establish the whole venue's capacity or a date-specific 10-person reservation.

Verification:

```sh
node --experimental-strip-types --test tests/activity-import.test.mjs tests/activities.test.mjs
```

The tests exercise the shared parser and actual SQLite import boundary: migration data preservation, the seven category counts, unknown field semantics, source URL parameters, duration distinctions, controlled photo paths, hiding samples and rerunning without overwriting manual edits. On 2026-11-14, the local D1 migration and data import were applied; local queries returned 70 published cards (10 per category), with all three illustrative rows preserved and hidden.
