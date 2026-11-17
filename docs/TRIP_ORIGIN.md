# Configurable trip departure

The single canonical `TripOrigin` value contains a display name and WGS84 longitude/latitude. `DEFAULT_TRIP_ORIGIN` preserves the actual Seoul Station terminal at126.9707793,37.5545547. Camera, endpoint labels, travel heading and both route providers should use the same server-supplied origin.

`getTripOrigin()` in `lib/trip-origin-store.ts` reads optional server-only `TRIP_ORIGIN_JSON`. With no variable it uses the central default. Example for a future meeting point:

```dotenv
TRIP_ORIGIN_JSON='{"name":"Hotel meeting point","longitude":127.0276,"latitude":37.4979}'
```

Supply that setting through the existing worker's environment configuration, then restart/release so both server-rendered props and the directions handler read the same value. No browser parameter can override it. A future DB-backed departure can replace this getter without changing the route/model interface; no unrequested picker, admin field or database table is added now.

`parseTripOrigin` validates an exact named coordinate object, finite coordinate bounds and a nonempty80-character/control-free label. Invalid JSON or configuration throws instead of quietly routing from a different departure. The public directions handler then returns its normal sanitized unavailable response without making a provider request. Home configuration failure should remain explicit rather than silently inventing a departure.

`createKakaoDirectionsHandler` accepts optional `getOrigin`; existing callers retain the canonical default. Each request captures/clones the validated origin, uses it for drive and transit start parameters and includes it in the successful `DrivingRoute.origin`. Pending-request keys include origin coordinates/name, preventing concurrent requests from sharing geometry for different meeting points. The UI should accept a successful response only when its origin matches the current props; camera/route framing must use the same coordinates.

Provider deadlines, concurrency, per-isolate call budgets, authentication at the outer route and geometry validation are unchanged. The new configuration is not a secret, but actual private accommodations should only be published deliberately. No real travel configuration was changed by this work.

Validation: the first custom-departure handler test failed against the old hardcoded Seoul origin, then passed. Provider/origin focused tests cover both provider parameter sets, returned metadata, pending-origin isolation, invalid config preventing calls, no-param defaults and validation. Historical success-response fixtures explicitly include the preserved Seoul Station origin. Node's strip-types tests resolve the shared `.ts` runtime import; the only TypeScript config addition is `allowImportingTsExtensions:true`, with existing noEmit retained.
