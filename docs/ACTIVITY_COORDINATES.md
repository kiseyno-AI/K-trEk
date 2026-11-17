# Sourced activity coordinates

`data/activity-coordinates.json` supplies WGS84 (`EPSG:4326`) map pins for all 70 candidate activities, checked on **2026-11-15**. The stable activity ID and original Korean name identify the existing row. Coordinates describe the sourced map feature, not a city centroid, a booking confirmation, a driving route or a medical qualification.

The origin is the actual **Seoul Station main-line terminal**: longitude `126.9707793`, latitude `37.5545547`. The primary [OSM node](https://www.openstreetmap.org/node/5772099311) and [OSM API record](https://api.openstreetmap.org/api/0.6/node/5772099311.json) identify the Korail ground-level station at 405 Hangang-daero. This replaces the preliminary planning anchor and avoids several distinct underground stations also called Seoul Station.

Every record includes its source URLs, checked date, matched address, source kind, pin label and an English description of what the pin means. The sources are primary OpenStreetMap features, operator-embedded map POIs, public map POIs matched to the exact venue/branch address, and municipality-supplied geographic records on Korea’s Public Data Portal. Public-map coordinates were taken from the resolved POI marker, rather than the map viewport center; those values can differ.

The precision labels describe the meaning of the pin, not a measured accuracy in meters:

| Precision | Meaning |
| --- | --- |
| `venue` | A specifically named venue or branch POI. A floor or table is not inferred. |
| `building` | The mapped building or its representative map point. |
| `site` | A named compound/site or arrival reference, rather than a particular door. |
| `area_start` | A specifically identified landmark, entrance, visitor center or meeting reference for exploring a wider area. It does not stand for the whole boundary. |

All 16 existing area records have explicit `area_start` pins. Examples include Bukchon Culture Center, Hyehwamun for the Naksan wall route, the Seoul Forest Visitor Center, Haneul Park Entrance, the Hwadamsup ticket office, the mapped Gwangjang Market entrance and Myeongdong Arts Theater. The DMZ pin is the municipality-supplied Imjingak Tourist Information Center point, opposite the peace-tour ticket office; it neither confirms a tour departure nor implies private-vehicle access to the Third Tunnel. The public [national tourist-information dataset](https://www.data.go.kr/data/15013112/standard.do) and [Paju’s information-center page](https://tour.paju.go.kr/tour/tourInfo/tourInfo01.jsp) support that arrival reference.

Namesakes and nearby branches were checked explicitly. Examples excluded from the final set are Samwon-affiliated restaurants elsewhere, the old Born and Bred address, a Seocho restaurant named Bicena, DDP’s bicycle-rental station, Hanboknam Premium/Bukchon, Leaders Cheongdam Dosan-daero, Jfeel Gangnam, other MUSINSA shops and motorway features named Dumulmeori.

## Preparing the local import

The importer only validates or writes SQL files; it never executes a database command or invokes an online geocoder.

```sh
node --experimental-strip-types scripts/import-activity-coordinates.mjs --check
node --experimental-strip-types scripts/import-activity-coordinates.mjs --sql-dir /tmp/korea-coordinate-sql-batches
```

`--sql` also prints the complete SQL for inspection. For D1 execution, use the directory of **complete-statement batches, each no more than 50,000 bytes**. Do not concatenate the full output into one unbounded Wrangler file; the local execution path has already rejected a larger content-import file with `SQLITE_TOOBIG`.

During parent integration, apply each numbered batch to the existing local `DB` binding:

```sh
for coordinate_sql in /tmp/korea-coordinate-sql-batches/activity-coordinates-*.sql; do
  node node_modules/wrangler/bin/wrangler.js d1 execute DB --local --config db/wrangler.local.jsonc --persist-to .wrangler/state --file "$coordinate_sql" || break
done
```

The guarded update:

- Matches the stable ID and original Korean name.
- Fills only a missing pair with `coordinate_status = 'unassigned'`, or enriches the provenance of an already-verified **identical** pair. This supports the three initial visual-QA pins.
- Preserves different manually verified pins, existing unverified coordinate pairs, renamed records and unrelated rows.
- Merges source URLs and appends coordinate evidence without replacing research, photo evidence, image fields, comments, reservation status or global `checked_at`.
- For an existing area row, preserves its description and appends `Map starting point: <pin_label>. <pin_description>` once, making the selected reference visible in the current detail UI.
- Leaves code-map coordinates unchanged. The public adapter uses verified actual coordinates for map focus.
- Makes no additional change on a second application, including timestamps.

## Verification and ownership

```sh
node --experimental-strip-types --test tests/activity-coordinates.test.mjs
```

The tests exercise all 70 points through `parseActivity` and `toActivity`, then apply the generated statements to actual in-memory SQLite. They verify identical-point enrichment, preservation of different manual coordinates, source/photo/editorial preservation, area-start copy, identity guards, complete-statement batch limits and idempotence. Literal checks distinguish the CNP Dogok Yangjae and Leaders Luxury Street branch pins, MUSINSA Daelim Warehouse and the Dumulmeori visitor office from nearby namesakes or map-camera coordinates.

This task writes only the coordinate manifest, importer, focused test and this document. It does not alter `data/activities-70.json` or write D1; the parent integration owns the base-data merge and local application. Booking dates, walking accessibility, live navigation paths, travel times and clinician credentials were not independently verified by this geographic work.

## Source attribution and one-time lookup policy

OpenStreetMap-derived points carry **© OpenStreetMap contributors**, with [copyright/ODbL attribution](https://www.openstreetmap.org/copyright) retained in the manifest and coordinate evidence. Preserve this attribution when displaying or reusing those points.

Nominatim was used only for a small, one-time research lookup, following its [usage policy](https://operations.osmfoundation.org/policies/nominatim/): one machine and one sequential requester, an identifying application User-Agent, at least 1.15 seconds between uncached queries, and a local cache so a query is not repeated. No Nominatim request code is shipped in the app or importer. Future application loads and imports read the static manifest and issue no public geocoder requests.


## Integrated result

On2026-11-15 the parent merged the verified coordinate/source fields into the base70 dataset using the same guarded SQL against in-memory SQLite, then applied four complete-statement batches to the existing local D1 store. All70 published rows are verified; all73 stored rows remain present, including the three hidden samples. A full before/after comparison confirmed photo fields, booking/editorial data, comments and unrelated fields unchanged. Area descriptions retain their existing text and add their named starting point. Public detail now projects the real station and venue through one persistent camera, draws their direct connection and shows the offline Seoul geography. No geocoding API is called by visitors.
