# Public trip releases

The public trip at `https://shawnai.win/ktravel` is the existing loopback Worker on 4330 behind the Observatory proxy on 4319. The launchd job is `com.kiseyno.ktravel`. Do not use the unrelated Sites hosting identity or expose the local admin.

## Reproduced failure

On 2026-11-16 the page returned 200 HTML while every sampled referenced CSS/JS URL returned 404, both directly on 4330 and through the public proxy. The exact files existed in `dist/client/ktravel/_next/static/`; the decorative map JSON still returned 200. `node scripts/check-public-assets.mjs` failed on the first stylesheet 404. Restarting the Worker alone made all 16 critical referenced CSS/JS assets return 200 with correct MIME types on both origins.

The cause was rebuilding `dist` while the old Wrangler Worker and asset manifest continued running. A successful build command alone did not update the running asset manifest. The proxy path and CSP were not the cause.

## Release command

```sh
npm run release:public
```

This helper snapshots the previous complete `dist` under ignored `.wrangler/public-release-*`, stops the existing public job, runs `build:public`, carries over the previous fresh manifest's immutable static files, reloads the launchd job, waits for readiness, and checks the actual HTML-referenced CSS/JS status and MIME types on 4330 and the public address. New files win if a path is shared. Only files referenced by the previous fresh Vite manifest survive, so retained historical generations do not accumulate.

Build or asset-gate failure restores the complete previous build and starts it again. If runtime recovery also fails, the helper retains the previous build backup and reports its path. D1 state is outside `dist`; no database, secret file, tunnel or proxy configuration is changed. The script never reads or copies the external secret into build source.

This is a short stopped-service release, not a zero-downtime deployment. Requests can briefly receive a gateway failure during the build/restart instead of a misleading 200 unstyled page. Already-open tabs keep the previous fresh build's hashed static files for one release; indefinitely old tabs are not retained. The helper is for the existing macOS launchd installation. Run one release at a time.

`npm run build:public` remains build-only validation. If it is run against the live output directory directly, immediately reload the public Worker before treating the build as a deployment. Prefer the release command for public changes.

## Verification

```sh
npm run check:assets
node --test tests/public-assets.test.mjs tests/public-release.test.mjs
```

The HTTP gate loads the real page, requires same-origin CSS and JavaScript references, and verifies every referenced critical asset returns 200 with CSS/JavaScript MIME rather than an HTML fallback. It ignores optional third-party analytics. It does not replace rendered browser QA, image checks, routing checks or GPU performance measurements.

Focused fixture HTTP/filesystem tests cover missing assets, 200 HTML masquerading as CSS, healthy delivery, matching new-server/new-assets release, previous CSS/JS availability, bounded old-generation retention, new-file precedence, build-failure rollback, asset-gate rollback and backup retention when runtime recovery fails. The integrating parent runs the final live release and browser check after the UI changes are complete.
