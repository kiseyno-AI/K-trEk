# Activity photo register

Checked 2026-11-15. All **70 cards use their actual named venue, exact branch, advertised activity or named area**. There are **0 area-context stand-ins**. The manifest has 69 assigned sources: 37 Commons photographs used by 38 cards, and 32 official-reference photographs. Seokchon Lake and Lotte World Adventure share one view in which both actual subjects appear.

There are 61 assigned local WebP files (11.02 MiB) and 8 existing direct clinic references. The 22 newly replaced subject photos are all local WebP (2.55 MiB), so they add no runtime external image origins. The previously verified clinic images and credits are preserved.

## Source of truth

`data/activity-photos.json` records the activity identity, displayed URL, caption, source page, author/publisher credit, rights state and source-backed visual subject review. Every assigned photo has `subjectEvidence.activity_ids`, a specific description, the inspected source page and `visually_confirmed: true`. New local files have dimensions and SHA-256 checksums.

An actual named area, such as Myeongdong shopping street or Bukchon Hanok Village, uses a photograph of that area. A specific business does not use a surrounding district or street as a substitute. Provider-published activity photographs may illustrate the actual named program without claiming a particular future cast, menu or session.

## Rights

- `licensed` is reserved for the 38 assignments whose Commons source pages identify a reusable photo license. Credits, license links and transformation details remain in the manifest.
- `official_reference` covers 32 assignments from an operator, official venue listing or public tourism source whose general reuse permission was not verified. Both the manifest license and public credit explicitly say `reuse license unverified`. This state is not a claim of ownership, permission or endorsement.

Photos were resized without upscaling to a maximum 1200×1200 bounding box and converted to WebP. Hanboknam’s source is a branch-specific composite: only its actual storefront photograph was cropped, with the source rectangle recorded. Korea House likewise uses only the actual savory meal photograph from its program-specific poster, excluding text and the separate Gohojae tea service. CNP’s already verified building crop is retained.

## Apply and verify

```sh
node scripts/import-activity-photos.mjs --check
node --test tests/activity-photo-subjects.test.mjs
node scripts/import-activity-photos.mjs
```

The canonical importer updates photo fields in local D1, preserving unrelated coordinates and editorial data. The new regression tests reject all 21 retired district stand-ins and the unrelated Korea House wedding scene and require a source-backed visual review for every card. Full application/production verification and deployment are owned by the parent task.

All 70 final card subjects were visually reviewed in `/tmp/venue-photos-all-70.png`; the changed subset is `/tmp/venue-photos-replaced-22.png`. A detailed source-to-subject audit and the remaining source limitations are in [VENUE_PHOTOS.md](VENUE_PHOTOS.md). Retired unused source metadata was removed from the canonical manifest; existing legacy files were not deleted.

## License and source register

| Assigned photo | Credit | Rights / source |
| --- | --- | --- |
| `samcheonggak` | el_ave | [CC BY 2.0](https://creativecommons.org/licenses/by/2.0) · [Source](https://commons.wikimedia.org/wiki/File:Samcheonggak.jpg) |
| `gyeongbokgung` | Basile Morin | [CC BY-SA 4.0](https://creativecommons.org/licenses/by-sa/4.0) · [Source](https://commons.wikimedia.org/wiki/File:Front_view_of_the_Imperial_Throne_Hall_Geunjeongjeon_at_Gyeongbokgung_Palace_with_blue_sky_in_Seoul.jpg) |
| `changdeokgung` | 문화재청 | [KOGL Type 1](http://www.kogl.or.kr/info/licenseType1.do) · [Source](https://commons.wikimedia.org/wiki/File:%EC%B0%BD%EB%8D%95%EA%B6%81_%EC%A0%84%EA%B2%BD_(2012).jpg) |
| `bukchon` | Bgag | [CC0](http://creativecommons.org/publicdomain/zero/1.0/deed.en) · [Source](https://commons.wikimedia.org/wiki/File:Bukchon_Hanok_Village_01.jpg) |
| `jongmyo` | 문화재청 | [KOGL Type 1](http://www.kogl.or.kr/info/licenseType1.do) · [Source](https://commons.wikimedia.org/wiki/File:Jeongjeon,_Jongmyo_(Autumn,_2012).jpg) |
| `hwaseong` | Lance Vanlewen | [CC BY-SA 4.0](https://creativecommons.org/licenses/by-sa/4.0) · [Source](https://commons.wikimedia.org/wiki/File:Hwaseong_Fortress,_Suwon,_Gyeonggi-do,_Republic_of_Korea_(2).jpg) |
| `folk-village` | AnbyG | [CC BY-SA 4.0](https://creativecommons.org/licenses/by-sa/4.0) · [Source](https://commons.wikimedia.org/wiki/File:Korean_Folk_House2.jpg) |
| `war-memorial` | *Youngjin | [CC BY-SA 4.0](https://creativecommons.org/licenses/by-sa/4.0) · [Source](https://commons.wikimedia.org/wiki/File:The_War_Memorial_Of_Korea_240615_02.jpg) |
| `seodaemun` | MonasteryInwang | [CC BY-SA 4.0](https://creativecommons.org/licenses/by-sa/4.0) · [Source](https://commons.wikimedia.org/wiki/File:Mountain_Inwang_and_Seodaemun_Independence_Park.jpg) |
| `naksan` | KO BYUNGSUK | [CC BY-SA 4.0](https://creativecommons.org/licenses/by-sa/4.0) · [Source](https://commons.wikimedia.org/wiki/File:%ED%95%9C%EC%96%91%EB%8F%84%EC%84%B1%EB%82%99%EC%82%B0%EA%B5%AC%EA%B0%84.jpg) |
| `deoksugung` | 문화재청 | [KOGL Type 1](http://www.kogl.or.kr/info/licenseType1.do) · [Source](https://commons.wikimedia.org/wiki/File:%EB%8D%95%EC%88%98%EA%B6%81_%EC%A0%84%EA%B2%BD_(2013).jpg) |
| `national-museum` | Richard Mortel from Riyadh, Saudi Arabia | [CC BY 2.0](https://creativecommons.org/licenses/by/2.0) · [Source](https://commons.wikimedia.org/wiki/File:National_Museum_of_Korea,_Seoul_(2)_(40236586235).jpg) |
| `leeum` | takato marui | [CC BY-SA 2.0](https://creativecommons.org/licenses/by-sa/2.0) · [Source](https://commons.wikimedia.org/wiki/File:Leeum,_Samsung_Museum_of_Art.jpg) |
| `ddp` | Eugene Lim | [CC BY 2.0](https://creativecommons.org/licenses/by/2.0) · [Source](https://commons.wikimedia.org/wiki/File:Dongdaemun_Design_Plaza_at_night,_Seoul,_Korea.jpg) |
| `gugak` | Michael Comella | [CC BY-SA 3.0](https://creativecommons.org/licenses/by-sa/3.0) · [Source](https://commons.wikimedia.org/wiki/File:National_Gugak_Center_in_Seocho-gu,_Seoul,_South_Korea.jpg) |
| `ikseon` | 오모군 | [CC BY 3.0](https://creativecommons.org/licenses/by/3.0) · [Source](https://commons.wikimedia.org/wiki/File:View_of_Ikseon-dong_from_National_Tax_Service_Jongno_District_Office.jpg) |
| `mmca-seoul` | 서울연구원 | [CC BY 4.0](https://creativecommons.org/licenses/by/4.0) · [Source](https://commons.wikimedia.org/wiki/File:MMCA_Seoul.jpg) |
| `seoul-forest` | Enigma7seven | [CC BY-SA 3.0](https://creativecommons.org/licenses/by-sa/3.0) · [Source](https://commons.wikimedia.org/wiki/File:Seoulforest_path01.jpg) |
| `botanic-park` | 슐라 | [CC BY-SA 4.0](https://creativecommons.org/licenses/by-sa/4.0) · [Source](https://commons.wikimedia.org/wiki/File:20261023_Seoul_Botanic_Park_5.jpg) |
| `haneul-park` | Ji-soo Seo | [CC BY-SA 4.0](https://creativecommons.org/licenses/by-sa/4.0) · [Source](https://commons.wikimedia.org/wiki/File:Cosmos_in_the_Sky_Park3.jpg) |
| `lotte-world-lake` | kallerna | [CC BY-SA 4.0](https://creativecommons.org/licenses/by-sa/4.0) · [Source](https://commons.wikimedia.org/wiki/File:Lotte_World_day_view_10.jpg) |
| `seonyudo` | traveloriented | [CC BY-SA 2.0](https://creativecommons.org/licenses/by-sa/2.0) · [Source](https://commons.wikimedia.org/wiki/File:Seonyudo_Park.jpg) |
| `banpo-fountain` | 서울특별시 소방재난본부(Seoul Metropolitan Fire & Disaster Headquarters) | [Public domain](https://commons.wikimedia.org/wiki/File:2011%EB%85%84_11%EC%9B%94_%EB%8C%80%ED%95%9C%EB%AF%BC%EA%B5%AD_%EC%84%9C%EC%9A%B8%ED%8A%B9%EB%B3%84%EC%8B%9C_%EB%AA%85%EC%86%8C_(Seoul_best_attractions)_%EB%8B%AC%EB%B9%9B%EB%AC%B4%EC%A7%80%EA%B0%9C%EB%B6%84%EC%88%981.jpg#Licensing) · [Source](https://commons.wikimedia.org/wiki/File:2011%EB%85%84_11%EC%9B%94_%EB%8C%80%ED%95%9C%EB%AF%BC%EA%B5%AD_%EC%84%9C%EC%9A%B8%ED%8A%B9%EB%B3%84%EC%8B%9C_%EB%AA%85%EC%86%8C_(Seoul_best_attractions)_%EB%8B%AC%EB%B9%9B%EB%AC%B4%EC%A7%80%EA%B0%9C%EB%B6%84%EC%88%981.jpg) |
| `olympic-park` | Tristan Surtel | [CC BY-SA 4.0](https://creativecommons.org/licenses/by-sa/4.0) · [Source](https://commons.wikimedia.org/wiki/File:Seoul_Olympic_Park_from_Lotte_World_Tower.jpg) |
| `hwadam` | Thqkrdl | [CC BY-SA 4.0](https://creativecommons.org/licenses/by-sa/4.0) · [Source](https://commons.wikimedia.org/wiki/File:%ED%99%94%EB%8B%B4%EC%88%B2.jpg) |
| `gwanggyo` | Jocelyndurrey

 This photo was taken with LG G3 | [CC BY-SA 4.0](https://creativecommons.org/licenses/by-sa/4.0) · [Source](https://commons.wikimedia.org/wiki/File:%EA%B4%91%EA%B5%90%ED%98%B8%EC%88%98%EA%B3%B5%EC%9B%90_(3).jpg) |
| `dumulmeori` | Foxy1219 | [CC BY-SA 4.0](https://creativecommons.org/licenses/by-sa/4.0) · [Source](https://commons.wikimedia.org/wiki/File:Yangpyeong_Dumulmeori_2019-11-11.jpg) |
| `lotte-tower` | mauveine.kim | [CC0](http://creativecommons.org/publicdomain/zero/1.0/deed.en) · [Source](https://commons.wikimedia.org/wiki/File:Seoul_Skyline_Night_2018.jpg) |
| `n-seoul-tower` | Rtflakfizer | [CC BY-SA 4.0](https://creativecommons.org/licenses/by-sa/4.0) · [Source](https://commons.wikimedia.org/wiki/File:Namsan_Tower_sunset,_Seoul.jpg) |
| `dora-observatory` | 책읽는달팽 | [CC BY-SA 3.0](https://creativecommons.org/licenses/by-sa/3.0) · [Source](https://commons.wikimedia.org/wiki/File:Civil_Dora_Observatory.jpg) |
| `gocheok` | Bigsmile20 | [CC BY 3.0](https://creativecommons.org/licenses/by/3.0) · [Source](https://commons.wikimedia.org/wiki/File:Gocheok_Skydome_Inside.JPG) |
| `hyundai-seoul` | kallerna | [CC BY-SA 4.0](https://creativecommons.org/licenses/by-sa/4.0) · [Source](https://commons.wikimedia.org/wiki/File:The_Hyundai_Seoul_Yeoui-dong_3.jpg) |
| `coex-library` | Republic of  Korea | [CC BY-SA 4.0](https://creativecommons.org/licenses/by-sa/4.0) · [Source](https://commons.wikimedia.org/wiki/File:Starfield_Library.jpg) |
| `shinsegae-main` | Minseong Kim | [CC BY-SA 4.0](https://creativecommons.org/licenses/by-sa/4.0) · [Source](https://commons.wikimedia.org/wiki/File:Shinsegae_Department_Store_in_Seoul.jpg) |
| `gwangjang` | Bgag | [CC0](http://creativecommons.org/publicdomain/zero/1.0/deed.en) · [Source](https://commons.wikimedia.org/wiki/File:Gwangjang_Market,_Seoul_01.jpg) |
| `myeongdong` | 서울연구데이터서비스 | [KOGL Type 1](http://www.kogl.or.kr/info/licenseType1.do) · [Source](https://commons.wikimedia.org/wiki/File:%EB%AA%85%EB%8F%998%EA%B8%B8_%EA%B1%B0%EB%A6%AC_(2020.03).jpg) |
| `ssamziegil` | JeongAhn | [Public domain](https://commons.wikimedia.org/wiki/File:Ssamziegil.jpg#Licensing) · [Source](https://commons.wikimedia.org/wiki/File:Ssamziegil.jpg) |
| `clinic-oracle` | Cheongdam OracleClinic | [Official source reference · reuse license unverified](https://en.cdoracleclinic.com/) · [Source](https://en.cdoracleclinic.com/) |
| `clinic-cnp-dogok` | CNP Skin Clinic Dogok Yangjae | [Official source reference · reuse license unverified](https://www.cnpskin.com/pc/cnp/community/news/notice.html?bmain=view&jijummid=cnpskin26&page=98&uid=17252) · [Source](https://www.cnpskin.com/pc/cnp/community/news/notice.html?bmain=view&jijummid=cnpskin26&page=98&uid=17252) |
| `clinic-leaders-cheongdam` | LEADERS Dermatology Cheongdam Luxury Street | [Official source reference · reuse license unverified](https://leaders-eng.com/) · [Source](https://leaders-eng.com/) |
| `clinic-renewme-dongdaemun` | Renewme Skin Clinic Dongdaemun | [Official source reference · reuse license unverified](https://english.renewmi.com/about/dongdaemun/) · [Source](https://english.renewmi.com/about/dongdaemun/) |
| `clinic-banobagi` | BANOBAGI Dermatologic Clinic | [Official source reference · reuse license unverified](https://english.skinbanobagi.com/) · [Source](https://english.skinbanobagi.com/) |
| `clinic-arumdaun-nara` | Arumdaun Nara Dermatology Gangnam / Gangnam Medical Tourism | [Official source reference · reuse license unverified](https://medicaltour.gangnam.go.kr/medical/clinic/view.do?medical_seq=48) · [Source](https://medicaltour.gangnam.go.kr/medical/clinic/view.do?medical_seq=48) |
| `clinic-wells-apgujeong` | WELLS Dermatology Clinic | [Official source reference · reuse license unverified](https://wellsskin.com/clinic/) · [Source](https://wellsskin.com/clinic/) |
| `clinic-id-gangnam` | id Clinic Gangnam | [Official source reference · reuse license unverified](https://www.idclinic.co.kr/en) · [Source](https://www.idclinic.co.kr/en) |
| `clinic-jfeel-hongdae` | JFEEL Clinic Hongdae | [Official source reference · reuse license unverified](https://hongdae.jfeelclinic.com/?idx=c5ffd1dac60588/c60c1a75a4bdef/c60f0da9ffbcff/c60f0dab5fbd04) · [Source](https://hongdae.jfeelclinic.com/?idx=c5ffd1dac60588/c60c1a75a4bdef/c60f0da9ffbcff/c60f0dab5fbd04) |
| `clinic-lienjang-gangnam` | LIENJANG BLACK Gangnam | [Official source reference · reuse license unverified](https://gangnam.lienjang.com/en) · [Source](https://gangnam.lienjang.com/en) |
| `venue-samwon-garden` | Dinehill / Samwon Garden | [Official source reference · reuse license unverified](https://dinehill.co.kr/samwon-garden/overview/) · [Source](https://dinehill.co.kr/samwon-garden/overview/) |
| `venue-hanilkwan-apgujeong` | Hanilkwan | [Official source reference · reuse license unverified](https://hanilkwan.co.kr/shopinfo/locations.html) · [Source](https://hanilkwan.co.kr/shopinfo/locations.html) |
| `venue-byeokje-galbi-bangi` | Byeokje Galbi | [Official source reference · reuse license unverified](https://www.thebyeokje.com/bangi) · [Source](https://www.thebyeokje.com/bangi) |
| `venue-balwoo-gongyang` | Balwoo Gongyang | [Official source reference · reuse license unverified](https://www.balwoo.or.kr/responsible_foodmenu_fall.php) · [Source](https://www.balwoo.or.kr/responsible_foodmenu_fall.php) |
| `venue-jin-jin` | Jin Jin / MICHELIN Guide | [Official source reference · reuse license unverified](https://guide.michelin.com/kr/en/seoul-capital-area/kr-seoul/restaurant/jin-jin) · [Source](https://guide.michelin.com/kr/en/seoul-capital-area/kr-seoul/restaurant/jin-jin) |
| `venue-born-and-bred-seoul` | BORN&BRED | [Official source reference · reuse license unverified](https://bandb.co.kr/kr/restaurant/restaurant.php?idx=1) · [Source](https://bandb.co.kr/kr/restaurant/restaurant.php?idx=1) |
| `venue-bicena` | SIGNIEL SEOUL / Bicena | [Official source reference · reuse license unverified](https://app.lottehotel.com/seoul-signiel/en/dining/restaurant-bicena) · [Source](https://app.lottehotel.com/seoul-signiel/en/dining/restaurant-bicena) |
| `venue-hwa-hae-dang-yeouido` | Hwa Hae Dang / MICHELIN Guide | [Official source reference · reuse license unverified](https://guide.michelin.com/us/en/seoul-capital-area/kr-seoul/restaurant/hwa-hae-dang) · [Source](https://guide.michelin.com/us/en/seoul-capital-area/kr-seoul/restaurant/hwa-hae-dang) |
| `venue-hikr-ground` | Korea Tourism Organization / HiKR Ground | [Official source reference · reuse license unverified](https://korean.visitkorea.or.kr/detail/rem_detail.do?cotid=8653d837-4660-46a2-a419-7b470d89a70c) · [Source](https://korean.visitkorea.or.kr/detail/rem_detail.do?cotid=8653d837-4660-46a2-a419-7b470d89a70c) |
| `venue-nanta-myeongdong` | PMC / NANTA | [Official source reference · reuse license unverified](https://www.nanta.co.kr/kr/show/detail.php?id=1) · [Source](https://www.nanta.co.kr/kr/show/detail.php?id=1) |
| `venue-hanboknam-gyeongbokgung` | HANBOKNAM | [Official source reference · reuse license unverified](https://hanboknam.com/hanboknam/branch/gyeongbok.html) · [Source](https://hanboknam.com/hanboknam/branch/gyeongbok.html) |
| `venue-bukchon-crafts` | Seoul Public Service Reservation / Bukchon Traditional Crafts Experience Center | [Official source reference · reuse license unverified](https://yeyak.seoul.go.kr/web/reservation/selectReservView.do?reSvc=Y&rsv_svc_id=S240122144020674558) · [Source](https://yeyak.seoul.go.kr/web/reservation/selectReservView.do?reSvc=Y&rsv_svc_id=S240122144020674558) |
| `venue-eland-cruise` | Seoul Tourism Organization / E-Land Cruise | [Official source reference · reuse license unverified](https://english.visitseoul.net/area/ElandCruise/ENPuz5pe1) · [Source](https://english.visitseoul.net/area/ElandCruise/ENPuz5pe1) |
| `venue-ongo-cooking` | O’ngo Food Communications | [Official source reference · reuse license unverified](https://ongofood.com/events/) · [Source](https://ongofood.com/events/) |
| `venue-ader-seongsu` | ADERERROR | [Official source reference · reuse license unverified](https://adererror.com/en/stockist/111?store_type=SPACE) · [Source](https://adererror.com/en/stockist/111?store_type=SPACE) |
| `venue-oliveyoung-n` | CJ Olive Young / CJ Newsroom | [Official source reference · reuse license unverified](https://newsroom.cj.net/cj-olive-young-n-seongsu-redefining-retail/) · [Source](https://newsroom.cj.net/cj-olive-young-n-seongsu-redefining-retail/) |
| `venue-musinsa-daelim` | MUSINSA | [Official source reference · reuse license unverified](https://about.musinsa.com/newsroom/2025-0821-k-fashion-edit2) · [Source](https://about.musinsa.com/newsroom/2025-0821-k-fashion-edit2) |
| `venue-haus-dosan` | Gentle Monster | [Official source reference · reuse license unverified](https://www.gentlemonster.com/int/en/stores/detail/779149629756556663) · [Source](https://www.gentlemonster.com/int/en/stores/detail/779149629756556663) |
| `venue-1million` | 1MILLION Dance Studio | [Official source reference · reuse license unverified](https://www.1milliondance.com/about-us) · [Source](https://www.1milliondance.com/about-us) |
| `venue-branme-seongsu` | BRANME | [Official source reference · reuse license unverified](https://branme.co.kr/en/seongsu/) · [Source](https://branme.co.kr/en/seongsu/) |
| `venue-running-man` | Seoul Tourism Organization / Visit Seoul | [Official source reference · reuse license unverified](https://english.visitseoul.net/other/RunningManExperienceCenter/ENPf78gji) · [Source](https://english.visitseoul.net/other/RunningManExperienceCenter/ENPf78gji) |
| `venue-korea-house-royal-dining` | Korea Heritage Agency / Korea House | [Official source reference · reuse license unverified](https://www.kh.or.kr/brd/board/644/L/SITES/100/menu/371?bbIdx=119978&brdType=R) · [Source](https://www.kh.or.kr/brd/board/644/L/SITES/100/menu/371?bbIdx=119978&brdType=R) |
