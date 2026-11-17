# Five additional Seoul restaurants

Checked **2026-11-16**. These five restaurants do not duplicate the ten food cards in `data/activities-70.json`. They add everyday Korean dishes to the existing dining choices. The dataset is `data/extra-food-2026-11.json`; photo and coordinate provenance is `data/extra-food-photos-2026-11.json`.

| Card | Experience | Address / public contact | Primary evidence |
| --- | --- | --- | --- |
| Myeongdong Kyoja Main Branch | Kalguksu and steamed mandu | 129 Toegye-ro, Jung-gu; +82-2-776-5559 (current Kakao branch listing) | [KTO restaurant record](https://english.visitkorea.or.kr/svc/contents/contentsView.do?vcontsId=99925), [current Kakao POI](https://place.map.kakao.com/1479300828) |
| Hadongkwan Myeongdong Main Branch | Beef gomtang with rice | 12 Myeongdong 9-gil, Jung-gu; +82-2-776-5656 | [Operator](https://www.hadongkwan.com/), [MICHELIN restaurant record](https://guide.michelin.com/en/seoul-capital-area/kr-seoul/restaurant/hadongkwan) |
| Tosokchon Samgyetang | Ginseng chicken soup in a hanok | 5 Jahamun-ro 5-gil, Jongno-gu; +82-2-737-7444 | [Seoul Tourism Organization](https://korean.visitseoul.net/area/TosokchonSamgyetang/KOPywjsmm), [STO accessibility audit](https://www.seouldanurim.net/facilities/D/TOURINFOTYPE5/43009) |
| Woo Lae Oak Main Branch | Pyongyang-style naengmyeon and optional bulgogi | 62-29 Changgyeonggung-ro, Jung-gu; +82-2-2265-0151 | [Seoul Tourism Organization](https://korean.visitseoul.net/citycenter/%EC%9A%B0%EB%9E%98%EC%98%A5-Wooraeok/KOP003207), [MICHELIN restaurant record](https://guide.michelin.com/en/seoul-capital-area/kr-seoul/restaurant/woo-lae-oak) |
| Gwanghwamun Mijin Main Branch | Cold buckwheat noodles and dipping broth | 1F, Le Meilleur Jongno Town, 19 Jong-ro, Jongno-gu; +82-2-730-6198 | [KTO restaurant record](https://english.visitkorea.or.kr/svc/contents/contentsView.do?vcontsId=82484), [MICHELIN restaurant record](https://guide.michelin.com/en/seoul-capital-area/kr-seoul/restaurant/mijin) |

## Conditions retained as unknown

No call, reservation or account action was made. Ten-person table availability, group booking rules, group discounts, English-speaking staff and date-specific opening were not verified. All five retain `booking_status: unknown`; the listed public phone is an inquiry route. English guide pages and Tosokchon's listed English menu do not establish English-speaking staff. No estimated food duration, Google rating/review count/Place ID, driving time or host comments were invented.

Tosokchon's dated accessibility audit reports a large total capacity, but no current capacity or ten-person table was inferred. It also notes steps to seating and uneven stone surfaces. The five choices are central-Seoul dining candidates, not a claim that every venue is wheelchair accessible. [STO audit](https://www.seouldanurim.net/facilities/D/TOURINFOTYPE5/43009)

## Address and contact discrepancies

- **Myeongdong Kyoja:** KTO's Korean address is 129 Toegye-ro, while its English address and the MICHELIN page retain 29 Myeongdong 10-gil. The current named Kakao POI at 129 Toegye-ro was selected; its phone is +82-2-776-5559. The operator website returned a verification page and could not be read, so no claim about its current group policy was imported. The dish photo is explicitly archival, not a photograph of the present main-branch building. [KTO](https://english.visitkorea.or.kr/svc/contents/contentsView.do?vcontsId=99925), [Kakao current branch](https://place.map.kakao.com/1479300828)
- **Mijin:** KTO and MICHELIN publish 02-730-6198; Kakao lists 02-732-1954. The consistent KTO/MICHELIN number is retained. These are not silently asserted to be equivalent. [KTO](https://english.visitkorea.or.kr/svc/contents/contentsView.do?vcontsId=82484), [MICHELIN](https://guide.michelin.com/en/seoul-capital-area/kr-seoul/restaurant/mijin), [Kakao](https://place.map.kakao.com/21326655)

## Geographic verification

The authorized Kakao Local keyword API returned the exact named restaurant and matching road address for all five. WGS84 coordinates below are provider POIs, not surveyed doors. Woo Lae Oak's separately returned parking-lot POI was rejected. API request URLs and the selected public feature metadata are saved in the provenance JSON; credentials were read server-side from the external configuration and are absent from these artifacts.

| Restaurant | Latitude | Longitude | Selected feature |
| --- | ---: | ---: | --- |
| Myeongdong Kyoja Main Branch | 37.5611814714638 | 126.986083137398 | [Kakao 1479300828](https://place.map.kakao.com/1479300828) |
| Hadongkwan Myeongdong Main Branch | 37.564430335182415 | 126.98502310323119 | [Kakao 1822111964](https://place.map.kakao.com/1822111964) |
| Tosokchon Samgyetang | 37.5777229294346 | 126.971494461387 | [Kakao 26545925](https://place.map.kakao.com/26545925) |
| Woo Lae Oak Main Branch | 37.56821185731751 | 126.99871865898974 | [Kakao 8025375](https://place.map.kakao.com/8025375) |
| Gwanghwamun Mijin Main Branch | 37.570844667978704 | 126.9799234417087 | [Kakao 21326655](https://place.map.kakao.com/21326655) |

Confidence is high for a named venue pin in each case; the address conflict for Myeongdong Kyoja is preserved above. Google Maps links use these coordinate pairs without claiming a verified Google Place ID.

## Actual-subject photographs

All five photos were visually checked and show food from the named restaurant. No generic neighborhood, substitute restaurant, generated image or patient photograph is used. Five local WebP assets total **503,888 bytes**, each within 1200×1200 without upscaling. Watermarks were retained. Runtime CSP needs no extra remote image origin.

| Restaurant | Actual subject | Rights / primary photo source |
| --- | --- | --- |
| Myeongdong Kyoja | Kalguksu, photographed in 2023; archival restaurant dish, not the present building | Mobius6, [Commons source](https://commons.wikimedia.org/wiki/File:Kalguksu_20230430_001.jpg), [CC BY-SA 4.0](https://creativecommons.org/licenses/by-sa/4.0/) |
| Hadongkwan | Gomtang from the exact Myeongdong restaurant listing | [MICHELIN primary listing](https://guide.michelin.com/en/seoul-capital-area/kr-seoul/restaurant/hadongkwan), official source reference; reuse license unverified |
| Tosokchon | Samgyetang photographed at the actual Jongno restaurant in 2016 | Korea.net / KOCIS, Jeon Han; [Commons source and verified KOCIS/Flickr license](https://commons.wikimedia.org/wiki/File:Malbok_Tosokchon_Samgyetang_04_(28730504880).jpg), [CC BY-SA 2.0](https://creativecommons.org/licenses/by-sa/2.0/) |
| Woo Lae Oak | The restaurant's bulgogi, a listed specialty alongside naengmyeon | [MICHELIN primary listing](https://guide.michelin.com/en/seoul-capital-area/kr-seoul/restaurant/woo-lae-oak), official source reference; reuse license unverified |
| Gwanghwamun Mijin | Cold buckwheat noodles and dipping broth, KTO image 3083647 | [KTO primary listing and gallery](https://english.visitkorea.or.kr/svc/contents/contentsView.do?vcontsId=82484), official source reference; reuse license unverified |

The two Commons derivatives remain under their respective CC BY-SA licenses; attribution includes the transformation and license URL. Tosokchon's historic EXIF has restrictive boilerplate, while Commons documents verified KOCIS CC BY-SA permissions with Flickr review/VRTS evidence; that distinction is preserved in the metadata. The other three pictures are source references, not claimed to have a transferable reuse license. Every original URL returned HTTP 200 with an image MIME on GET; KTO's image MIME is `image/jpg`. Exact original URLs, asset dimensions, hashes and rights evidence are in the provenance JSON.

## Safe import and verification

`scripts/import-extra-food.mjs` only validates and generates SQL. It never invokes Wrangler or changes a database. Its five `INSERT OR IGNORE` statements preserve every existing row and edit, including any of the new cards if the script is rerun. It does not hide samples, replace all rows or update existing metadata. `created_at` and `updated_at` use the database defaults for newly inserted cards.

```sh
node --experimental-strip-types scripts/import-extra-food.mjs --check
node --experimental-strip-types scripts/import-extra-food.mjs --sql /tmp/extra-food-2026-11.sql
node --experimental-strip-types --test tests/extra-food-import.test.mjs
```

The focused SQLite integration test applies all existing migrations, imports the five cards, edits a new card, imports again and proves the manual row and restaurant edit are preserved. Asset existence, schema/default parsing, unique IDs and verified coordinate status are checked. The parent task owns final integration, database application, broader gates, Graphify refresh and release.
