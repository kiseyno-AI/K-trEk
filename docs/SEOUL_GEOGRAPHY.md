# Seoul geography sources

Source and license checks: 2026-11-15. This note records provenance for the locally prepared Seoul vectors; it does not establish survey accuracy.

## Administrative boundaries

The usable upstream snapshot is **`ver20261001`**, `HangJeongDong_ver20261001.geojson`, from the author-maintained [vuski/admdongkor repository](https://github.com/vuski/admdongkor). Its [README](https://github.com/vuski/admdongkor/blob/3bc00489b76696db864bdbea4b19985cdfa8b403/README.md) describes WGS84 GeoJSON derived from SGIS administrative-dong boundaries with subsequent corrections and administrative changes. This is a modified community distribution, not a direct official SGIS download.

The file's latest modifying [data commit](https://github.com/vuski/admdongkor/commit/3bc00489b76696db864bdbea4b19985cdfa8b403), **`3bc00489b76696db864bdbea4b19985cdfa8b403`**, was committed on 2026-10-17. The commit records the 2026-10-01 boundary epoch. At inspection, repository HEAD was `078ef4ac13b8bfeb215d2eabace49f4fdea71d5e`; pin the data commit for reproducible downloads rather than following `master`.

| Item | Pinned source |
| --- | --- |
| Nationwide administrative-dong GeoJSON, 34,652,038 bytes | [Download GeoJSON](https://raw.githubusercontent.com/vuski/admdongkor/3bc00489b76696db864bdbea4b19985cdfa8b403/ver20261001/HangJeongDong_ver20261001.geojson) |
| Dataset license and upstream attribution notice | [LICENSE-DATA](https://raw.githubusercontent.com/vuski/admdongkor/3bc00489b76696db864bdbea4b19985cdfa8b403/LICENSE-DATA) |
| Dataset version manifest | [manifest.json](https://raw.githubusercontent.com/vuski/admdongkor/3bc00489b76696db864bdbea4b19985cdfa8b403/dist/data/manifest.json) |

The pinned [dataset license](https://raw.githubusercontent.com/vuski/admdongkor/3bc00489b76696db864bdbea4b19985cdfa8b403/LICENSE-DATA) applies **CC BY 4.0** to the repository's modifications and requires preservation of SGIS and vuski/admdongkor attribution. The repository's MIT license covers its source code, not these boundary files. [CC BY 4.0](https://creativecommons.org/licenses/by/4.0/) calls for appropriate credit, a license link, and an indication of modifications.

### Official SGIS evidence and verification limit

The official [SGIS boundary catalog](https://sgis.mods.go.kr/view/pss/openDataIntrcn) lists census administrative boundaries at province, district and dong levels as public, free SHP data; its latest listed annual boundary year was 2025 at inspection. The mirror's 2026 epoch therefore should not be described as an official 2026 SGIS release.

The official [SGIS copyright policy](https://sgis.mods.go.kr/jsp/member/copyright.jsp) says works marked **KOGL Type 1** can be reused with source credit, including commercial use and modification. It also says users must check that the individual work carries that mark. The [KOGL Type 1 terms](https://www.kogl.or.kr/info/licenseType1.do) explain the attribution and source-link conditions. The former `sgis.kostat.go.kr` policy URL redirects to this `sgis.mods.go.kr` page.

**Evidence boundary:** vuski/admdongkor's LICENSE-DATA explicitly identifies its original SGIS boundaries as KOGL Type 1. The official policy corroborates the meaning of that license, but this research did not obtain the original SGIS download package or independently inspect an item-specific KOGL mark. Preserve the upstream attribution statement; do not present the mirror's assertion as an independently verified license label on an official downloaded artifact.

For the prepared boundary extract, retain credit to **SGIS** and **vuski/admdongkor**, links to both sources and **CC BY 4.0**, and a statement that this project extracted, merged and/or simplified the geometry. The complete upstream attribution wording remains in [LICENSE-DATA, section 3](https://github.com/vuski/admdongkor/blob/3bc00489b76696db864bdbea4b19985cdfa8b403/LICENSE-DATA#L28-L37).

## OpenStreetMap river geometry

OpenStreetMap geometry is a separate source from the administrative boundary extract. [OpenStreetMap's copyright page](https://www.openstreetmap.org/copyright) identifies its data license as **Open Data Commons Open Database License 1.0 (ODbL)** and requires OpenStreetMap credit and notice of that license. Keep the river source IDs, retrieval date, extraction method and ODbL notice with the prepared river dataset.

The river extraction used the [Overpass interpreter](https://overpass-api.de/api/interpreter), selecting `natural=water` polygons and `waterway=river` lines named `한강` or `Han River` inside `(south, west, north, east) = (37.40, 126.76, 37.72, 127.20)`. Its reported OSM base timestamp was **2026-11-15T16:31:38Z**. It uses these source objects, with inner rings retained for islands:

| Geometry | OSM object | Metadata verified from the OSM API |
| --- | --- | --- |
| River water multipolygon | [relation 152336](https://www.openstreetmap.org/relation/152336) | [version 55; 2026-05-07](https://www.openstreetmap.org/api/0.6/relation/152336.json), `natural=water`, `water=river`, `name=한강` |
| River water multipolygon | [relation 3769500](https://www.openstreetmap.org/relation/3769500) | [version 28; 2024-12-23](https://www.openstreetmap.org/api/0.6/relation/3769500.json), `natural=water`, `water=river`, `name=한강` |
| River centerline | [way 378066781](https://www.openstreetmap.org/way/378066781) | [version 50; 2025-07-18](https://www.openstreetmap.org/api/0.6/way/378066781.json), `waterway=river`, `name=한강` |

These object version dates describe the parent relation/way records; member ways and nodes have their own histories. Preserve the prepared extract to reproduce its geometry rather than treating live object URLs as immutable snapshots.

For the displayed river, use a readable linked credit such as **[River geometry © OpenStreetMap contributors](https://www.openstreetmap.org/copyright)** beside or in a corner of the map. The [OSMF attribution guidelines](https://osmfoundation.org/wiki/Licence/Attribution_Guidelines#Interactive_maps) accept the contributor wording and describe map placement. For redistributed river data, include attribution and a direct [ODbL 1.0 link](https://opendatacommons.org/licenses/odbl/1-0/) in the data or nearby documentation. The ODbL text distinguishes a rendered work from a derivative database and sets the latter's share-alike and access conditions in sections 4.4–4.6; the river extract should remain explicitly identified as OSM-derived data rather than being labeled CC BY 4.0 with the boundaries.

No geocoding or Nominatim requests were used for this research.

## Delivered asset and renderer contract

`public/trip/seoul-geography.json` is the offline, WGS84 `[longitude, latitude]` extract. Version 1 is **110,728 bytes** with **4,750 vertices**, covering `[west, south, east, north] = [126.76, 37.40, 127.20, 37.72]`. It contains no roads, satellite image, live lookup or runtime data-service dependency.

| Field | Meaning |
| --- | --- |
| `version`, `bounds` | Schema version and exact clipping rectangle |
| `attribution` | Separate source labels, source URLs, licenses and license URLs |
| `sources` | Pinned boundary URL/epoch and OSM base timestamps/object identifiers |
| `boundary` | Two closed dissolved Seoul rings: the city outline and a tiny source exclusion near the river |
| `districts` | All 25 gu, with English `name` and closed boundary `lines` |
| `river` | Two closed OSM water outer rings, clipped to the rectangle |
| `riverHoles` | 18 actual in-bounds OSM inner rings; these remain dry, including mapped islands |
| `riverCenterlines` | One clipped actual Han River centerline, not an invented ribbon |
| `labels` | Eight English `{name, longitude, latitude}` anchors |

Fill `river` and `riverHoles` with even-odd/stencil parity. A direct triangle fan painted as ordinary filled geometry would incorrectly fill concavities and islands. No triangles are supplied. `districts[].lines` and `boundary` are line geometry; the original source's tiny internal exclusion is retained rather than redrawn. Shared district borders can be stroked twice by a naive per-district renderer.

The producer merges the pinned 427 Seoul administrative-dong polygons by cancelling matching shared edges, first by gu and then citywide. It clips vectors to the stated rectangle, applies Douglas–Peucker simplification (boundary tolerance `0.00006°`, river tolerance `0.000035°`), and rounds geometry to six decimal places. This is roughly several metres of simplification, varying by axis and latitude. These modifications preserve recognizable geography, not cadastral or navigation accuracy. Minor source features outside the rectangle are deliberately excluded. Islands remain holes wherever the OSM source encodes them; no additional south-channel water or island boundary is invented.

The cached nationwide source was checked against the pinned Git blob **`877acdc676ee332414cd0d6dd0a2b143dbfbd7d7`**. Its SHA-256 is `843ece3a0b3429742cd4a1b699cc13987a88b5e5401f382e7fdaaa194ea5e605`.

## English labels

Neighborhood labels use actual station anchors as convenient area references, not district centroids. Their OSM query base timestamp is **2026-11-15T16:33:43Z**.

| Display label | Source anchor | Longitude, latitude |
| --- | --- | --- |
| Jongno | [Jongno 3-ga station, node 7207442616](https://www.openstreetmap.org/node/7207442616) | 126.9923242, 37.5704405 |
| Hongdae | [Hongik Univ. Line 2 station, node 13055976391](https://www.openstreetmap.org/node/13055976391) | 126.9234474, 37.5566261 |
| Gangnam | [Gangnam station, node 5927529147](https://www.openstreetmap.org/node/5927529147) | 127.0279845, 37.4980418 |
| Jamsil | [Jamsil station, node 6033315017](https://www.openstreetmap.org/node/6033315017) | 127.1001365, 37.5132169 |
| Yeouido | [Yeouido station, node 6039313670](https://www.openstreetmap.org/node/6039313670) | 126.9243018, 37.5216685 |
| Seongsu | [Seongsu station, node 5935554450](https://www.openstreetmap.org/node/5935554450) | 127.0561016, 37.5445688 |
| Seoul Station | [Main-line terminal, node 5772099311](https://www.openstreetmap.org/node/5772099311) | 126.9707793, 37.5545547 |
| Han River | [Actual vertex of way 378066781](https://www.openstreetmap.org/way/378066781) nearest 127°E | 126.9990311, 37.5170669 |

Seoul Station's source explicitly identifies the ground-level train terminal; it is about 20 metres from the proposed main-terminal point `126.97065, 37.55470`. It does not use the separate subway, AREX or GTX station nodes. The Han River label is inside a sourced water polygon and outside all island holes. The renderer may suppress the context label for Seoul Station when its dedicated departure label is already visible.

## Offline regeneration and checks

`scripts/prepare-seoul-geography.mjs` uses only Node's standard library and performs **no network requests**. Give it a source-cache directory containing:

- `sgis-20261001.geojson`: the exact pinned nationwide GeoJSON linked above.
- `han-overpass.json`: the full geometry response to the following Overpass query. To recreate the same historical state, add `[date:"2026-11-15T16:31:38Z"]` to its settings.
- `anchors-overpass.json`: the station query below; its historical setting is `[date:"2026-11-15T16:33:43Z"]`.

```overpass
[out:json][timeout:45];
(
  way["natural"="water"]["name"~"한강|Han River"](37.40,126.76,37.72,127.20);
  relation["natural"="water"]["name"~"한강|Han River"](37.40,126.76,37.72,127.20);
  way["waterway"="river"]["name"~"한강|Han River"](37.40,126.76,37.72,127.20);
);
out geom;
```

```overpass
[out:json][timeout:35];
nwr["railway"="station"]["name"~"홍대입구|강남|잠실|여의도|성수|서울|종로3가"](37.40,126.76,37.72,127.20);
out center tags;
```

```sh
node scripts/prepare-seoul-geography.mjs /path/to/source-cache
node --test tests/seoul-geography.test.mjs
```

The prepared artifact is committed/delivered locally, so builds and map navigation never call Overpass or SGIS. Keeping this artifact reproduces the delivered geometry even if the public services or their historical retention later change. Source-cache inputs are development-only, not bundled with the app.

Six focused tests validate the 150KB/vertex/ring bounds, all 25 districts, closed finite WGS84 geometry, an actual west-to-east Han centerline between north/south Seoul anchors, eight English labels, source/license metadata, correct terminal placement, Han label containment, island containment and absence of proper ring self intersections. Repeating the producer with the same cached inputs produced the identical artifact SHA-256: `4e8e6af7b41643cfacfafeccdcd7cee941b2869961d98e6c00a904ea7602f1b5`. Final screen styling, stencil rendering and label collisions are checked by the integrating renderer task.
