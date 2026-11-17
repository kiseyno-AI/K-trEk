# Clinic photo replacement register

Checked 2026-11-15. All ten wellness cards now have a photograph of their named clinic or exact branch: reception, waiting area, exterior or lounge. No area-context photograph, generated venue image or patient-face photograph is used.

## Rights and delivery

All ten are `official_reference`: the source publicly provides the photograph, but an explicit reuse license was not found. This state does **not** mean `licensed` or `owned`, and does not imply permission, clinic endorsement or photographer attribution. Public captions and credits are English. The manifest keeps the official branch evidence, original URL, transformation details and rights distinction.

Eight images remain direct HTTPS references to official clinic/CDN assets. Each original URL returned HTTP 200 and an `image/*` content type both without a Referer and with `Referer: https://shawnai.win/ktravel/` plus cross-site image request headers. None redirected. The manifest records status, content type, final URL, byte length and file signature. These checks demonstrate current delivery, not a reuse permission or a guarantee of future host availability.

Two controlled local WebP references preserve their `official_reference` status:

- CNP Dogok Yangjae: only the two actual Mokwon Building photographs are cropped from the clinic’s 2015 directions guide. The current official English branch page confirms the same address. The archived photograph is labeled as such.
- Arumdaun Nara Gangnam: the Gangnam government medical tourism facility gallery supplies the exact clinic lounge photo. Its endpoint returns HTTP 200 but declares `application/octet-stream`; JPEG decoding was checked and a local WebP avoids relying on MIME sniffing. The source page and the Seoul medical tourism profile both identify 390 Gangnam-daero.

## Identity checks

LEADERS uses Cheongdam Luxury Street at 445 Apgujeong-ro, not Cheongdam Dosan-daero. id uses the Gangnam Lobby asset at 437 Gangnam-daero, not Sinsa. JFEEL uses the explicitly titled Hongdae fifth-floor desk page at 166 Yanghwa-ro. LIENJANG uses its Gangnam Black asset at 403 Gangnam-daero.

BANOBAGI uses the official English site exterior photograph, whose full-resolution building signs identify BANOBAGI Dermatologic Clinic. The official location page confirms 219 Bongeunsa-ro. The 2023 Nonhyeon project in AVEC’s official portfolio independently corroborates the facility. AVEC asset requests returned 403, so no AVEC asset or Doctours mirror is included. The separate Yeoksam location at 503 Nonhyeon-ro was not substituted. The preliminary suspicion that the hero was stock was resolved by inspecting the full original with its signage.

## Integration and verification

```sh
node scripts/import-activity-photos.mjs --check
node scripts/import-activity-photos.mjs --sql > /tmp/activity-photos.sql
```

The clinic register is merged into the canonical `data/activity-photos.json`. Use the existing shared importer for all 70 assignments; `--check` validates, `--sql` prints SQL, and no arguments updates local D1. SQL preserves unrelated editorial fields and existing references; repeated application does not duplicate evidence. There is no second clinic-specific importer.

All ten final images were decoded with sharp and reviewed together in a contact sheet. Local assets have SHA-256 checksums and are no larger than their sources. The generated SQL was verified with an isolated SQLite fixture for all ten updates, unrelated-data preservation and repeat-import stability. Integration applied the canonical assignments to local D1 and verified the public English clinic cards, card scroll/keyboard navigation and the English detail/source panel. All 70 published records pass the shared reader; the three hidden samples remain stored.

## Photo assignments

| Clinic | Image | Branch evidence |
| --- | --- | --- |
| 청담오라클피부과 | Cheongdam OracleClinic reception and waiting area, 612 Seolleung-ro. | [Source](https://en.cdoracleclinic.com/) · 612 Seolleung-ro, Gangnam-gu, Seoul |
| 차앤박피부과 도곡양재 | CNP Skin Clinic Dogok Yangjae, Mokwon Building exterior (2015 official directions archive). | [Source](https://www.cnpskin.com/pc/cnp/community/news/notice.html?bmain=view&jijummid=cnpskin26&page=98&uid=17252) · 3F Mokwon Building, 248 Gangnam-daero, Gangnam-gu, Seoul |
| 리더스피부과 청담명품거리점 | LEADERS Dermatology Cheongdam Luxury Street branch interior. | [Source](https://leaders-eng.com/) · 3F Diana Building, 445 Apgujeong-ro, Gangnam-gu, Seoul |
| 리뉴미피부과 동대문점 | Renewme Skin Clinic Dongdaemun reception desk. | [Source](https://english.renewmi.com/about/dongdaemun/) · 2F Giseung Plus Building, 251 Eulji-ro, Jung-gu, Seoul |
| 바노바기피부과 | BANOBAGI Dermatologic Clinic exterior at 219 Bongeunsa-ro. | [Source](https://english.skinbanobagi.com/) · Doonam Building, 219 Bongeunsa-ro, Gangnam-gu, Seoul |
| 강남 아름다운나라피부과 | Arumdaun Nara Gangnam clinic lounge, from its official medical tourism profile. | [Source](https://medicaltour.gangnam.go.kr/medical/clinic/view.do?medical_seq=48) · 12F Mijin Plaza, 390 Gangnam-daero, Gangnam-gu, Seoul |
| 웰스피부과 압구정 | WELLS Dermatology Clinic Apgujeong front desk. | [Source](https://wellsskin.com/clinic/) · 8F Apgujeong Building, 842 Nonhyeon-ro, Gangnam-gu, Seoul |
| 아이디의원 강남점 | id Clinic Gangnam reception lobby. | [Source](https://www.idclinic.co.kr/en) · 11F, 437 Gangnam-daero, Seocho-gu, Seoul |
| 제이필의원 홍대점 | JFEEL Clinic Hongdae, fifth-floor reception desk. | [Source](https://hongdae.jfeelclinic.com/?idx=c5ffd1dac60588/c60c1a75a4bdef/c60f0da9ffbcff/c60f0dab5fbd04) · 5F and 7F Mirae Plaza, 166 Yanghwa-ro, Mapo-gu, Seoul |
| 리엔장 강남 | LIENJANG BLACK Gangnam lounge at 403 Gangnam-daero. | [Source](https://gangnam.lienjang.com/en) · 343 Gangnam Tower, 403 Gangnam-daero, Seocho-gu, Seoul |

## Image origins for the trip route CSP

Only these eight exact HTTPS origins are needed for the remote clinic images:

- `https://cdn.imweb.me`
- `https://d2ufsw33tc3szc.cloudfront.net`
- `https://english.renewmi.com`
- `https://english.skinbanobagi.com`
- `https://gangnam.lienjang.com`
- `https://hongdae.jfeelclinic.com`
- `https://leaders-eng.com`
- `https://wellsskin.com`
