# Selectable transit geometry — 2026-11-16

The existing server-only Kakao Map public-transit request now preserves the route geometry that accompanies each displayed fastest alternative. No extra provider request is needed to switch between Drive, Bus, Subway and Subway + bus.

## Provider contract

[Kakao Map REST API: public transit routes](https://developers.kakao.com/docs/en/kakaomap/rest-api#get-public-transit-routes) documents `routes[].steps[]`: each step has a `properties.type` of BUS, SUBWAY or WALKING and `path.points` containing `[longitude, latitude]` pairs. Both requested coordinate systems remain WGS84. Totals and geometry come from the same selected provider alternative.

The shared model adds `RouteSegment = { mode: 'drive' | 'bus' | 'subway' | 'walk'; path: [number, number][] }` and `TransitOption.segments`. Driving keeps its existing `path`; the client can wrap that as one drive segment. Transit step order and separate leg boundaries are retained. Only consecutive identical points are removed.

The adapter accepts at most 256 steps and 50,000 vertices per alternative, validates finite WGS84 coordinates and rejects unknown step types or degenerate paths. Missing or invalid geometry produces an empty `segments` list while retaining valid time, distance and fare totals. A client must describe the selected path as unavailable in that case; it must never substitute the driving road or connect disconnected legs. A slower alternative is not substituted merely because it has geometry.

Existing two-megabyte provider response limits, shared eight-second deadline, transit timeout, abort ownership, pending-request sharing, four-route concurrency and twenty-provider-calls-per-minute budget remain unchanged. Only approved provider fields reach the client; no REST key or provider diagnostic is returned.

## Verification

The new public-handler regression failed before implementation, then passed. Provider tests cover fastest-alternative correspondence, ordered mixed-mode steps, duplicate removal, invalid/missing/oversized geometry, keeping usable totals and preserving the successful drive when transit fails.

One authorized live request on November 16 returned fifteen alternatives with the documented step/path shape. Replaying that captured response through the public handler produced three available modes. After deduplication the selected subway option had 164/3/151 points (subway/walk/subway), bus had 179/2/59 (bus/walk/bus), and mixed had 55/12/151 (bus/walk/subway). These observations validate shape, not future timetable or fare accuracy. The temporary capture contains only public restaurant routing data and is local with mode 0600; the API key was never written into it or tool output.

This backend check does not establish the rendered color, camera framing or touch behavior; those are verified by the parent UI implementation.
