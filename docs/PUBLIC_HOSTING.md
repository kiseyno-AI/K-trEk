# Public Korea travel

Public URL: https://shawnai.win/ktravel. Shawn AI Lab’s project navigation links directly to it, using Korean/English labels from the existing locale system.

The production Vinext Worker is built for basePath=/ktravel. `lib/site-path.ts` prefixes local map/photo and editor API URLs; external photo URLs are left unchanged. `scripts/prepare-public-path.mjs` moves generated public trip assets into dist/client/ktravel/trip so static paths agree with the build. This fixed an observed empty200 response from the unprefixed asset layout.

```sh
npm run build:public
npm run start:public
```

The Mac login service `com.kiseyno.ktravel` runs the built Worker on127.0.0.1:4330 with the same project-local .wrangler/state D1 store. Its LaunchAgent is under ~/Library/LaunchAgents and logs are under ~/Library/Logs/KTravel. After rebuilding, restart only this service with `launchctl kickstart -k gui/$(id -u)/com.kiseyno.ktravel` so the static asset manifest is rebuilt too. The local development editor remains at http://localhost:3000/admin while npm run dev is running.

The existing `com.kiseyno.observatory-shawnai` service on4319 streams GET/HEAD /ktravel requests to4330 after its existing Host/Origin gates. It does not pass cookies, authorization or Set-Cookie. A trip-scoped CSP supports the built framework hydration without weakening the Lab’s own CSP. Admin/API paths and privileged queries are blocked; writes return405. The existing tunnel and account-data protections are unchanged. A failure of the trip upstream returns a generic502.

The existing source Sites project is K-Scene NYC, so it was deliberately not redeployed or renamed. This publication uses the requested Shawn AI Lab hosting route. D1 is durable on this Mac; the Mac/login service/tunnel must remain running. No credential or tunnel configuration was copied into Git.

Changed trip sources: app/activity-explorer.tsx, app/globals.css, app/planet-canvas.tsx, app/planet-shaders.ts, app/admin/activity-editor.tsx, lib/activities.ts, lib/site-path.ts, next.config.ts, package.json; data/import/migration/photo assets and tests are listed in ACTIVITY_IMPORT.md and ACTIVITY_PHOTOS.md. Lab changes live in /Users/shawn/openclaw-observatory/server.mjs, public/index.html, public/locales/app.js, public/styles.css and its tests/registry/docs. No dependencies were added. Search/region state and controls were deleted; only five nearby cards mount.

Validation evidence and limitations: MOTION_PERFORMANCE.md. The public endpoint, static JSON/photo assets, Lab-link navigation, card wheel/key movement and detail entry were checked after restarting the two dedicated services.
