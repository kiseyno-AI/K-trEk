# English activity content

The 70 supplied activity records now use English for all public text, including location descriptions and addresses, duration evidence, booking and group conditions, language-support notes and source evidence. `name_ko` is retained as the original internal identity used by the photo importer and admin data model. Existing English names, summaries, activity descriptions, source and booking URLs, numbers, nulls and status fields are unchanged.

This is a translation of the supplied research, not a new verification. Group thresholds, uncertain simultaneous access, travel-date booking uncertainty, conditional day trips and clinical qualification limitations remain explicit. Planned stay ranges remain separate from the Gugak 80-minute and Ongo approximately 180-minute program durations. Clinic stay durations remain null, and an English website or consultation route does not establish on-site English-speaking staff.

Validate the artifact or print local-update SQL:

```sh
node --experimental-strip-types scripts/translate-activity-content.mjs --check
node --experimental-strip-types scripts/translate-activity-content.mjs --sql > /tmp/activity-content-english.sql
```

The script only validates or prints SQL. It never executes a database update or accesses a remote service. Apply to the existing local database in batches of complete SQL statements, each at most 50,000 UTF-8 bytes. Do not pass the full approximately 440 KB file to Wrangler: local D1 rejects that file with `SQLITE_TOOBIG`. The generator emits one complete statement per line; preserve those boundaries when batching, execute batches sequentially and inspect both process status and JSON error/success results.

Integration applied 77 statements in ten bounded batches to the existing local D1 store. All 70 published records now contain English public text; all 73 records, including the three hidden samples, remain present. The separate canonical photo import updated English photo credits and actual clinic images.

The update is deliberately narrow:

- It matches the 70 stable IDs and original Korean names. No other records are changed.
- Each editorial field changes only if its value still exactly matches the known original Korean value. A manual English edit is preserved.
- Source evidence changes only when its known original editorial prefix matches exactly. Any appended photo evidence, URL, license or credit remains in place.
- Seven known Korean attribution labels are transliterated or translated only inside the appended `Photo (...)` evidence section. Image URLs, caption and attribution columns, manifests and original author/license records are owned by the separate photo update and are not changed by this script.
- The script leaves all nonlanguage data and timestamps for unchanged rows alone. A second application makes no further changes.

Tests:

```sh
node --experimental-strip-types --test tests/activity-english.test.mjs
```

The checks require all 70 public records to contain no Hangul outside `name_ko`, and run the generated SQL against actual in-memory SQLite. They cover the complete imported set, original-source guards, photo evidence suffixes and credits, manual English edits, unrelated records, program durations and idempotence. A read-only inspection of the current local D1 photo evidence found no unknown Korean suffixes after the seven known credit substitutions.

Source pages, clinician qualifications and travel-date availability were not independently rechecked for this translation.
