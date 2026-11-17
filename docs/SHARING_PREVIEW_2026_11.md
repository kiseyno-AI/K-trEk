# Sharing preview correction — 2026-11-16

The public page title/description already identifiedK-trEk, but bothOpenGraphandTwitterimages resolved to the previous`korean-events-nyc…/og.png`, whose bitmap literally said“뉴욕의 한국 공연과 이벤트”. This was reproduced against both local and public SSR HTML.

The canonical page andog:urlnow identify`https://shawnai.win/ktravel`. Both preview image fields use the existing controlled Korea-at-nightPNG on that same public path, with its actual1672×941dimensions and2,024,103bytefile. No new image/dependency/pipeline. The unused old`public/og.png`was deleted; layout no longer reads the obsoleteSITE_URLoverride. The page itself and the other agent’s local-only voice guard are preserved.

Changed files:`app/layout.tsx`,`.env.example`,`public/og.png`(removed),`scripts/check-sharing-preview.mjs`,`package.json`,registry/report.

`node scripts/check-sharing-preview.mjs http://localhost:3000/`first failed with the exact oldNYCimageURL, then passed after the metadata correction. It checks canonical/title/image fields, rejects oldNYCmetadata, and fetches the actual PNG to verify MIME, signature, dimensions and bounded size. The same check then passed the local public Worker, the actual public URL and the fresh share-query URL after release.

Messenger applications may retain a preview already cached for an unchanged URL; changing the server metadata does not erase a message already sent or directly purge a third-party cache. No messages are sent by this verification.


Public release:18CSS/JS asset checks passed on both local Worker andpublichost. Facebookexternalhit,TwitterbotandKakaotalk-scrapUArequests each returned200with the newKoreapreview; the publicvoicebutton remained absent. `https://shawnai.win/ktravel?share=ktrEk-2`serves the same trip with the correct canonical and provides a fresh URL for previously cached messenger previews. No third-party cache purge or message send is claimed.

Combined gates:173tests passed, lint/TypeScript/diffcheck passed, registry7families/45reviewed sources/67free patterns. Graph refreshed1235nodes/2664edges; the optionalSQLparser andCSS/font extractors remain unavailable. The imperative sharing checker and wheel test lack extracted graph symbols but were directly run and reviewed.


Public DOM verification matched the intendedcanonical/Koreaimage, confirmedzero public voice controls, and exercised one-cardwheelmovement on the releasedbundle. Wheel changes are confined to the existing explorer handler, `lib/carousel-wheel.ts`, its3regressiontests and the smoke wiring assertion; see`TRACKPAD_SWIPE_2026_11.md`. The old450msaccepted-eventcooldown was removed in favor of one stable, timer-freegesturedecision. No account/DB changes or voice-feature publication.
