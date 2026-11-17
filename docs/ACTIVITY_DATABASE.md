# Activity database and editor

The local prototype uses one D1 product table, `activities`, with 70 user-supplied candidates published across seven categories. Public labels and editorial text for all 70 cards are English; the original `name_ko` values remain internal identity and source-matching fields. Translation does not mark the underlying facts as newly verified. The original three illustrative examples remain stored but hidden, for 73 total rows. See [ACTIVITY_IMPORT.md](ACTIVITY_IMPORT.md) and [ACTIVITY_PHOTOS.md](ACTIVITY_PHOTOS.md).

## Local setup

Run from the repository root:

```sh
node --experimental-strip-types scripts/db-setup.mjs
```

The command applies pending append-only migrations with Wrangler’s migration journal to local D1 and inserts missing seed IDs. It uses the same `DB` binding, placeholder database ID and project-local `.wrangler/state` directory as `vite.config.ts`. Existing edits are preserved by `INSERT OR IGNORE`. Schema creation and seeding never run during a page or API request. Restart the development server after the initial binding change.

Open `/admin` to create or edit a card. A published card appears on the trip page when it is opened or refreshed; clearing Published keeps the record in D1 but hides it from the public list. Card IDs are stable and cannot be renamed during an edit. The editor preserves unsaved form values after validation/network errors and asks before discarding edits, including its client-side Back link. That link guard was added after the final independent review; native empty-form validation and save-to-page integration were browser-tested, while the Back guard and Vinext defaultPrevented handling were source-checked.

Local and hosted D1 are separate databases. This change enables and tests the local binding; it does not provision, migrate or publish a remote database. Before hosting, apply the reviewed schema through the supported deployment migration path and configure admin authorization. No database credentials are stored in the source.

## Data distinctions

- English public names, category IDs and province/metro region IDs are explicit. Original Korean names are retained internally for identity checks and are not rendered on the public trip page. A city display name is separate from the region filter ID.
- Point addresses and area/route boundaries are separate fields.
- Suggested stay minutes/labels and operator program minutes/evidence are separate.
- Booking URL, public contact, link/date confirmation state and notes are separate.
- Facility capacity, group reservation, discount and simultaneous participation conditions have separate fields.
- English website URL, staff support and program support are separate; staff/program default to Unknown.
- Photo references are URL arrays. Displayed images use an explicit rights state: `licensed`, `owned`, or `official_reference`. The last means “Official website reference · reuse license unverified,” not a license or ownership claim. It requires an image URL and HTTPS source references. Licensed/owned local files use a restricted `/trip/photos/` path; official references may use HTTPS original images or controlled local branch images. The current 70 assignments comprise 49 venue views and 21 labeled area-context views, with 60 licensed assignments and 10 actual clinic references (eight HTTPS and two local). English captions and credits preserve this distinction. Source review for the clinic images is dated 2026-11-15; see [CLINIC_PHOTOS.md](CLINIC_PHOTOS.md). Hidden illustrative samples retain a separate sample-only preview field without asserting rights.
- Actual YouTube videos, a search link and an official channel link are separate fields.
- Google Maps URL, rating, review count, Place ID and verification state are separate. Unknown values remain `null`.
- Driving time remains `null` until verified for the travel date. The import does not invent travel-minute values.
- Actual latitude/longitude and code-map latitude/longitude have independent status fields. Unverified actual coordinates are not automatically shown on the map. The sample map coordinates retain prototype camera behavior and are marked Illustrative. For imported Seoul venues without exact coordinates, the UI can frame the known Seoul area; it explicitly labels that regional view rather than implying a venue coordinate.
- Shawn and Sun comments remain blank. The old invented host quotes are not stored as personal comments.
- Source URLs, verification evidence and checked date are stored per card. Public evidence text is English; original identity fields and source URLs are retained. Photo-source review dates are separate from activity verification dates. Unknown activity checked dates remain blank, and the seed evidence explicitly describes its unverified sample status.

## API

`GET /api/activities` returns `{ activities: Activity[] }` containing published display records. `listActivities()` supplies the same display shape to the server-rendered page.

Authorized editor operations:

- `GET /api/activities?admin=1` returns complete records, including hidden cards and timestamps.
- `POST /api/activities` creates a card from the field names in `lib/activities.ts`.
- `PUT /api/activities/:id` replaces an existing card's editable fields. Its body ID must match the route ID.

Responses use `Cache-Control: no-store`. Invalid input returns 400, denied access 403, missing update target 404, duplicate IDs 409 and unavailable persistence 503. A failed write never reports success or silently falls back to browser storage.

## Authorization and validation

Loopback editing is allowed only in development. Hosted editor access requires both a Sites-authenticated user ID and an email present in the server-side `ADMIN_EMAILS` allowlist. An empty allowlist denies remote editing. Both the admin page and every privileged API operation enforce the check. Platform-authenticated headers are meaningful only behind the Sites authentication boundary; do not expose the Worker directly with a separate trust policy.

Writes require JSON, reject mismatched Origin headers and cap the actual streamed body at 64 KiB. Validation rejects unknown fields/IDs, unsupported URL protocols, credentials embedded in URLs, invalid number ranges, incomplete coordinate pairs, invalid dates and displayed images without an explicit supported rights state. Official references retain their unverified-license status and require HTTPS provenance; they are not silently promoted to licensed images. SQL values use D1 bound parameters. URL arrays and booleans are serialized at the store seam; database schema constraints also preserve basic types and enum values. Append-only migration `0003_official_photo_references.sql` adds the new rights value while preserving every existing column, timestamp and primary-key index.

## Verification

```sh
node --experimental-strip-types --test tests/activities.test.mjs tests/official-photo.test.mjs tests/activity-english.test.mjs
```

Validation covers real SQLite persistence, Unicode/null values, verified versus illustrative map/image values, input failures, honest sample seeds, authorization, cross-origin rejection and streamed payload limits. Photo tests exercise the 73-row rights upgrade, complete column/timestamp/index preservation, official-reference provenance, metadata import stability and preservation of editorial edits. English coverage checks apply to all 70 public records while original Korean identity stays internal. Earlier browser QA saved a temporary temple title, refreshed the trip page to confirm it, then restored it; an empty New form was blocked by native required-field validation. Actual YouTube video URLs remain separate from search/channel links. The public `/ktravel` proxy is read-only and blocks admin/API paths. Local `/admin` remains the editor; no Sites-hosted admin authorization or remote D1 migration is claimed.

UI registry ownership: `activity-admin`, implemented by `app/admin/activity-editor.tsx`, styles in `app/admin/admin.module.css`, called from `app/admin/page.tsx`. States include new/existing/dirty/saving/saved/error/hidden and page-level access-denied/database-unavailable states. The controls adapt native form elements; no additional UI package was added.
