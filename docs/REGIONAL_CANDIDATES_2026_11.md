# Nine regional day-trip additions

Reviewed 2026-11-16. This is an additive batch of three nature/sightseeing cards, three activities and three restaurants across Gyeonggi, Gangwon and Incheon. It does not change the original 75 candidates or any saved host comments/ratings.

| Candidate | Card category / area | Primary subject and visitor evidence |
|---|---|---|
| The Garden of Morning Calm | Nature / Gapyeong, Gyeonggi | [KTO named garden](https://english.visitkorea.or.kr/svc/contents/contentsView.do?vcontsId=110690) identifies themed gardens and the 432 Sumogwon-ro address. Selected coordinate is the matching ticket-office POI rather than the alternate main listing at 427. Autumn photo is a seasonal reference. |
| Nami Island | Nature / Chuncheon, Gangwon | [KTO island and ferry information](https://english.visitkorea.or.kr/svc/contents/contentsView.do?vcontsId=111127). The island is in Chuncheon, but **road directions intentionally end at mainland Gapyeong Wharf**; a ferry transfer is required. The area description and coordinate evidence state this explicitly. Winter photo is a seasonal reference. |
| Pocheon Art Valley | Nature / Pocheon, Gyeonggi | [KTO named complex](https://english.visitkorea.or.kr/svc/contents/contentsView.do?vcontsId=66111), [Pocheon City](https://www.pocheon.go.kr/eng/contents.do?key=10793). Former quarry, Cheonjuho Lake and outdoor cultural spaces. Pin is near the facility approach, not in the lake. |
| Gwangmyeong Cave | Activities / Gwangmyeong, Gyeonggi | [KTO cave attraction](https://english.visitkorea.or.kr/svc/contents/contentsView.do?vcontsId=194429). Underground visitor route in the former mine; parking, approach walk and optional exhibitions remain separate. |
| Gangchon Gimyujeong Railbike | Activities / Chuncheon, Gangwon | [KTO exact branch](https://english.visitkorea.or.kr/svc/contents/contentsView.do?vcontsId=72722) identifies railbike, train and return-transfer components at 1383 Gimyujeong-ro. This is not the Gyeonggang branch. |
| Yeongjong Seaside Railbike | Activities / Incheon, Yeongjong-gu | [KTO coastal railbike](https://english.visitkorea.or.kr/svc/contents/contentsView.do?vcontsId=112553) identifies four-seat bikes. Ten travelers need multiple bikes and a confirmed departure. The current Kakao district name is Yeongjong-gu; an older language field on KTO still says Jung-gu. |
| Bonsuwon Galbi Main Branch | Food / Suwon, Paldal-gu | [KTO named restaurant](https://english.visitkorea.or.kr/svc/contents/contentsView.do?vcontsId=86767), [KTO Suwon galbi feature](https://english.visitkorea.or.kr/svc/contents/contentsView.do?vcontsId=221253). The card/photo show jumbo beef ribs. Published overall seating and an English menu do not establish a ten-person table or English-speaking staff. |
| Chuncheon Tongnamujip Dakgalbi Main Branch | Food / Chuncheon, Gangwon | [KTO named restaurant](https://english.visitkorea.or.kr/svc/contents/contentsView.do?vcontsId=188463), [KTO local-food feature](https://english.visitkorea.or.kr/svc/contents/contentsView.do?vcontsId=251692). Use the pan-dakgalbi main branch at 763 Sinsaembat-ro, not the separate charcoal branch. The selected gallery image shows its pan ingredients rather than a building. |
| Sinseung Banjeom Incheon Main Branch | Food / Incheon, Jemulpo-gu | [KTO named restaurant](https://english.visitkorea.or.kr/svc/contents/contentsView.do?vcontsId=216846), [KTO jjajang feature](https://english.visitkorea.or.kr/svc/contents/contentsView.do?vcontsId=221247). The card/photo show its yuni-jjajang noodles. Current KTO destination and Kakao use Jemulpo-gu; the older food feature says Jung-gu at the same road number. |

## Coordinates and uncertainty

All nine WGS84 pins were checked against the current Kakao Local keyword API, matching the exact name/address/contact or an explicitly named entrance/wharf. The manifest records POI IDs and source links; no credential is stored in the dataset or tooling. The Nami ferry-departure pin is a deliberate route endpoint, not an island centroid.

Admission, bike departures, ten-person seating, group discounts, English staffing and date-specific booking remain unconfirmed. Website/contact routes are not booking confirmations. Planning duration labels on non-food cards are editorial suggestions, not operator program times. All nine driving times, Google ratings/Place IDs, Shawn/Sun comments and host ratings remain null. Food planning stay is null. Each card has an English city/district-level `card_location` without a neighborhood.

## Photos

All nine selected photos were downloaded from the KTO gallery for the exact named place and visually inspected. The three restaurant images show their main dishes, not exterior/context streets. Local WebP files are under `public/trip/photos/regional-*.webp`, totaling 1,001,866 bytes. This removes runtime hotlink dependence and requires no additional CSP origin.

The conversions apply EXIF orientation and scale inside 1200×1200 without upscaling, preserving the complete frame and source markings. Originals, captions, dimensions and SHA-256 hashes are in `data/regional-candidate-photos-2026-11.json`. These are **official references with reuse permission unverified**, not rights-cleared images. Downloading them locally does not change that status.

Final subject contact sheet: `/tmp/regional-research/regional-final-contact.jpg`.

## Import and verification

`node --experimental-strip-types scripts/import-regional-candidates.mjs --check` validates nine unique candidates, balanced categories, checked regional coordinates, empty personal/travel values and valid local WebP files. `--sql /tmp/regional-candidates-2026-11.sql` writes `INSERT OR IGNORE` statements using the canonical activity columns after all migrations. It does not execute database writes.

The focused SQLite test applies every migration, imports nine cards, verifies city/district locations and photo integrity, edits a host comment/rating, then reruns the import. The edited record and an unrelated manual card must remain unchanged. Wrong/duplicate IDs, missing verified pins and incomplete assets are rejected.

No database was changed by this research/import preparation. Parent integration owns backup, migration application, database import, public HTTP checks and deployment. Date-specific operations, live routes for all nine and transferable image reuse rights were not confirmed.
