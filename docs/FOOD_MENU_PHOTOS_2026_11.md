# Food menu photograph refresh — 2026-11-16

Scope: the fifteen Food cards already published before the regional additions. All fifteen assignments now point to validated local WebP dish/menu photographs under `/trip/photos/food-menu-*.webp`; none points to a storefront, dining room or unrelated street. The original 70-card manifest and five-card seed file remain unchanged.

The new [manifest](../data/food-menu-photos-2026-11.json) records the identity, dish, publisher, original/download URL, local checksum/dimensions, license status and subject review. New downloads returned HTTP200 with image content types. Existing correct dish assets were reused without re-encoding; their original provenance is retained and they were visually reviewed again. All fifteen local files decode as WebP, with 300–1200px dimensions and 1,469,008bytes combined.

| Restaurant card | Dish pictured | Source |
|---|---|---|
| Samwon Garden | Hanwoo beef short ribs | [MICHELIN named restaurant main-dish gallery](https://guide.michelin.com/en/seoul-capital-area/kr-seoul/restaurant/samwon-garden) |
| Hanilkwan Apgujeong | Signature sirloin bulgogi | [Operator restaurant menu, The Bulgogi](https://m.hanilkwan.co.kr/nd/product.html) |
| Korea House | Royal Korean cuisine course | [Korea Heritage Agency autumn2026 program](https://www.kh.or.kr/brd/board/644/L/SITES/100/menu/371?bbIdx=119978&brdType=R) |
| Byeokje Galbi Bangi | Hanwoo barbecue meal | [Operator Bangi gallery](https://www.thebyeokje.com/bangi) |
| Balwoo Gongyang | Seasonal temple-cuisine course dish | [Operator autumn2026 menu](https://www.balwoo.or.kr/responsible_foodmenu_fall.php) |
| Jin Jin | Chinese seafood main dish | [MICHELIN named restaurant main-dish gallery](https://guide.michelin.com/kr/en/seoul-capital-area/kr-seoul/restaurant/jin-jin) |
| Born and Bred Seoul | Hanwoo beef | [MICHELIN Seoul New Hall main-dish gallery](https://guide.michelin.com/en/seoul-capital-area/kr-seoul/restaurant/born-and-bred) |
| Bicena | Seasonal Korean main course | [MICHELIN named restaurant main-dish gallery](https://guide.michelin.com/en/seoul-capital-area/kr-seoul/restaurant/bicena) |
| Samcheonggak | Korean course platter, archival reference | [KTO's specific Samcheonggak Korean Restaurant record](https://big5chinese.visitkorea.or.kr/svc/contents/contentsView.do?vcontsId=87040) |
| Hwa Hae Dang Yeouido | Soy-marinated crab | [MICHELIN named restaurant main-dish gallery](https://guide.michelin.com/us/en/seoul-capital-area/kr-seoul/restaurant/hwa-hae-dang) |
| Myeongdong Kyoja | Kalguksu,2023archival photograph | [Commons file / Mobius6,CCBY-SA4.0](https://commons.wikimedia.org/wiki/File:Kalguksu_20230430_001.jpg) |
| Hadongkwan Myeongdong | Gomtang | [MICHELIN named restaurant gallery](https://guide.michelin.com/en/seoul-capital-area/kr-seoul/restaurant/hadongkwan) |
| Tosokchon | Samgyetang,2016archival photograph | [Commons file / KOCIS,CCBY-SA2.0](https://commons.wikimedia.org/wiki/File:Malbok_Tosokchon_Samgyetang_04_(28730504880).jpg) |
| Woo Lae Oak | Bulgogi | [MICHELIN named restaurant gallery](https://guide.michelin.com/en/seoul-capital-area/kr-seoul/restaurant/woo-lae-oak) |
| Gwanghwamun Mijin | Buckwheat noodles | [KTO named restaurant gallery](https://english.visitkorea.or.kr/svc/contents/contentsView.do?vcontsId=82484) |

Samwon, Hanilkwan, Born and Bred, Bicena and Samcheonggak previously showed buildings/interiors; they were replaced. Ten already-correct dish photographs were retained at the new controlled paths. Samcheonggak's current operator menu was also inspected: its AJAX menu endpoint lists course items but does not supply food photographs. KTO's restaurant-specific gallery supplies the actual food photograph; this is not the similarly named Songpa restaurant or a general complex exterior. Its menu is seasonal, so the caption does not promise that exact dish on a future date.

## Import and checks

```sh
node scripts/import-food-menu-photos.mjs --check
node scripts/import-food-menu-photos.mjs --sql /tmp/food-menu-photos-2026-11.sql
node --experimental-strip-types --test tests/food-menu-photos.test.mjs
```

The helper validates all fifteen identities and assets, then writes SQL only; it never executes a database command. Each statement guards `id`, Korean identity and Food category. Updates touch only `image_url`, `image_rights`, `image_caption`, `image_attribution` and `image_reference_urls`. The new photo source is first in the reference list for correct linked attribution, with existing references retained. No activity row, description, source-evidence prose, coordinate, comment, rating, publication status or timestamp is changed. A real SQLite migration/import test proves full-row preservation outside those five fields, unchanged unrelated records and idempotent reruns.

Apply this override **after** the original 70-photo importer and the extra-five-food import. Rerunning an older baseline photo importer afterward would intentionally restore that older manifest's assignments. The coordinating agent owns backup, DB application, public release and HTTP verification.

## Rights and verification limits

Two photos retain verified Commons licenses and linked attribution; thirteen remain `official_reference` with reuse permission unverified. Local hosting solves runtime hotlink/referrer availability, not copyright permission. In particular, replacing Samcheonggak's licensed building image with an actual food image changes that assignment's rights status; aggregate licensed counts must be recalculated rather than copied from the previous report.

Contact sheet: `/tmp/food-menu-final-contact.jpg`. No new dependency was installed; the existing Sharp package converted two JPEG sources, and valid WebP or already-local assets were copied. No creative alteration, generative imagery or watermark removal was performed. The public database and deployment were not changed in this subtask. The eight remote clinic images and other non-Food assets are outside this manifest's scope.
