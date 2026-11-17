# Route-aware labels, regional outlines and configurable departure

## Shared departure contract

`PlanetCanvas` accepts optional `origin:TripOrigin` with `name`, `longitude` and `latitude`; it defaults to the central `DEFAULT_TRIP_ORIGIN` from `lib/trip-origin.ts`. All origin markers, HTML label names, projection, endpoint geometry and detail framing use this same object. `cameraForDetail` accepts an optional final origin argument after its existing road argument, preserving existing callers. `SEOUL_STATION` remains a compatibility alias for the default.

The page/controller must request directions with the same server-configured origin and verify the response origin before passing a map route into the renderer. This work adds configuration/model support, not an origin-picker interface or a second geocoder. The provider/server integration is maintained by the parent/backend task.

## Journey label placement

The previous helper only separated two label rectangles. The new `placeJourneyLabels` works with measured label sizes, actual projected endpoints, the unoccluded map frame and separate projected provider path legs. It scores12finite placements around each pin and the frame corners. Route crossings include6pxclearance, pin coverage includes8pxclearance, and labels reserve8pxbetween each other. Segment/rectangle clipping detects roads crossing a label even when both segment endpoints are outside it. Mixed-mode leg boundaries remain separate; no connection is invented across gaps.

The pair score prioritizes separate labels and marker visibility, then route visibility and proximity to each pin. If a constrained frame has no completely clear arrangement, it selects the least obstructed in-frame pair; it does not put labels under the detail panel. Placement reuses cached viewport/font/text dimensions and recomputes only when camera, route, destination/origin or measured layout changes. Idle twinkle frames reuse the result. No per-frame layout read, observer or timer is added beyond the prior owned measurement observer.

Three focused regressions cover a route crossing the full map, short320pxmobile frames and a Busan departure that must not retain Seoul camera fitting. Existing default-origin camera/route tests remain passing.

## Administrative boundaries outside Seoul

`public/trip/korea-regions.json` is an offline WGS84 extract from the same pinned SGIS-derived distribution already used for Seoul. Source: [vuski/admdongkor data commit](https://github.com/vuski/admdongkor/commit/3bc00489b76696db864bdbea4b19985cdfa8b403), [pinned GeoJSON](https://raw.githubusercontent.com/vuski/admdongkor/3bc00489b76696db864bdbea4b19985cdfa8b403/ver20261001/HangJeongDong_ver20261001.geojson), [dataset license](https://raw.githubusercontent.com/vuski/admdongkor/3bc00489b76696db864bdbea4b19985cdfa8b403/LICENSE-DATA). The source's2026-10-01epoch has16province-level units. Its modified geometry is CC BY4.0 with retained SGIS/vuski attribution; this is a community-modified distribution, not a new official SGIS release. Existing `SEOUL_GEOGRAPHY.md` records the upstream license verification limit.

The producer extracts only source edges shared across province or city/gu identities, omitting coastlines already drawn by the country geometry. Chains stop at true junctions before Douglas–Peucker display simplification, then round to six decimals. Province tolerance is0.0008degrees; city tolerance0.0002degrees. This is display geography, not a cadastral boundary. The source is checked against SHA-256 `843ece3a0b3429742cd4a1b699cc13987a88b5e5401f382e7fdaaa194ea5e605`.

The671,563byteartifact contains4,139province-chain points and25,126city-chain points covering230city/guareas outside Seoul. Sejong is represented by its province-level outline and has no additional internal city boundary. Seoul keeps its existing finer25guasset. A focused asset test checks source identity/license, bounds, WGS84 finiteness, countrywide coverage and the800KB/40,000pointbudgets.

Province outlines appear at country scale in the existing muted geographic palette. City/guoutlines fade in with regional zoom; grouped bounds skip offscreen provincial batches. All lines append to the existing district buffer, retaining10buffers/fiveprograms/fourtextures. No light, DPR, source-quality or camera-resolution cut.

Regenerate without network/dependencies:

```sh
node scripts/prepare-korea-regions.mjs /path/to/sgis-20261001.geojson
node --experimental-strip-types --test tests/planet-camera.test.mjs tests/korea-regions.test.mjs
```

Final visible desktop/mobile label-route and region-style checks, actual frame pacing, and hidden/reduced-motion/retention checks belong to the parent release QA. Geometry tests and source review alone do not establish GPU performance or final visual quality.

Node-only scoring microbenchmark (synthetic projected polyline, not GPU/browser):1,000rounds with300points averaged0.0137ms/call;20rounds at the50,000pointprovider cap averaged1.142ms/call. Geographic projection cost is additional during flights; settled frames reuse cached placement. Label measurement uses the actual border-box rectangle in the existing resize/text measurement batch.
