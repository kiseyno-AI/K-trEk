# Routing API options for Korea Travel

Checked **2026-11-15** against official documentation and provider staff answers. This is research only: no API key, account, payment method, live route request, or routing integration was created.

## Recommendation

For Seoul Station → Seoul/Gyeonggi destinations, evaluate **Kakao Mobility for driving** and **TMAP for driving/walking** first. Both return actual road/path geometry and publish useful free allowances. KakaoMap now also documents a separate walking API with a smaller free allowance. These are capped free tiers, not unlimited free services.

The remaining integration question is permission to render the results on this site's **custom WebGL map**. Public documentation reviewed did not establish an explicit grant for that use for Kakao or TMAP. Confirm that display use and its attribution/caching conditions before choosing a provider; geometry availability alone does not establish display rights.

## Comparison

| Service | Published free allowance | Korean routing and geometry | Account / cost conditions |
| --- | --- | --- | --- |
| **Kakao Mobility Directions** | Driving **10,000 requests/day** | Domestic driving; ordered WGS84 road vertices, distance and duration | Kakao Developers app + REST API key. Provider staff says the free driving allowance needs no separate partnership; exceeding it requires a paid arrangement. Driving overage starts at **KRW 8/request** in the first published volume band. [Pricing](https://developers.kakaomobility.com/price/), [staff clarification](https://devtalk.kakao.com/t/directions-api-navigation-api/149487) |
| **TMAP Open API** | Route guidance **1,000 requests/day** | Domestic driving and pedestrian endpoints; GeoJSON `LineString` coordinates | Developer registration, appKey and free product activation. Paid products apply beyond the free allowance. [Official allowance/terms](https://tmapapi.tmapmobility.com/terms.html), [current product pricing](https://openapi.sk.com/products/calc?menuSeq=5&svcSeq=4) |
| **KakaoMap REST routing** | Walking **1,000/day**; transit and bicycle each **1,000/day** | Separate walking/transit/bicycle APIs; walking response contains coordinate paths | REST API key + KakaoMap activation. Only the **first activated app per developer account** receives the free quota. Other apps or additional usage need Biz Wallet and paid API configuration; walking overage **KRW 10/request**. [Quota/pricing](https://developers.kakao.com/docs/ko/getting-started/quota), [activation policy](https://developers.kakao.com/docs/ko/kakaomap/common) |
| **Google Routes** | Compute Routes **Essentials 10,000/month**; Pro **5,000/month** | Current official coverage table marks South Korean **driving and walking directions unavailable** | Billing-enabled project + API key/OAuth required. Traffic-aware options trigger the Pro SKU. Its non-Google-map restriction is also unsuitable for this renderer. [Pricing](https://developers.google.com/maps/billing-and-pricing/pricing), [billing rules](https://developers.google.com/maps/documentation/routes/usage-and-billing), [country coverage](https://developers.google.com/maps/coverage) |

No signed-in signup/payment flow was tested. In particular, this report does **not** establish that every provider's free signup can be completed without a payment card. Kakao's common platform quota policies also apply; daily allowances can change.

## Geometry and endpoint details

- **Kakao Mobility:** public `GET https://apis-navi.kakaomobility.com/v1/directions`, with a REST API key in the authorization header. Full responses expose `routes[].sections[].roads[].vertexes` as alternating longitude/latitude values. Use the ordinary public endpoint, not the separate partner-only `/affiliate` API. [Directions reference](https://developers.kakaomobility.com/guide/navi-api/directions.html), [setup](https://developers.kakaomobility.com/guide/navi-api/start.html)
- **TMAP:** car `POST /tmap/routes`, walking `POST /tmap/routes/pedestrian` on `apis.openapi.sk.com`, authenticated by `appKey`. Request and response coordinate systems can be set to `WGS84GEO`; response features include ordered `LineString` coordinates. Official examples include Korean routes. [Driving reference](https://tmapapi.tmapmobility.com/webservice/docs/tmapRouteDoc.html), [pedestrian reference](https://tmapapi.tmapmobility.com/webservice/docs/tmapRoutePedestrianDoc.html)
- **KakaoMap:** `GET https://dapi.kakao.com/v2/routing/walk`, using a REST API key. WGS84 output is supported; `route.legs[].steps[].path.points` supplies coordinate pairs. This is a different product from the older partnership-only Kakao Mobility pedestrian API. [REST routing reference](https://developers.kakao.com/docs/ko/kakaomap/rest-api)

## Display, attribution and storage constraints

- **Google:** standard **non-EEA** service terms §19.2 prohibit combining Routes content with a non-Google map. Permission to show results without a map (§19.1) does not permit a custom map. §19.3 permits temporary latitude/longitude caching for up to 30 consecutive days, not unrestricted permanent route storage. EEA billing-account terms differ. Google attribution requirements still apply where use is permitted. [Current service terms](https://cloud.google.com/maps-platform/terms/maps-service-terms), [Routes policies](https://developers.google.com/maps/documentation/routes/policies)
- **TMAP:** published restrictions prohibit using API-derived data for **24 hours or more after storage**. Do not permanently precompute the 70 routes into the activity database. An explicit arbitrary-map display permission and exact attribution treatment were not located in the reviewed public references. [Terms/restrictions](https://tmapapi.tmapmobility.com/terms.html)
- **Kakao:** an official Mobility staff answer permits a described **map-free** driving-data display, with appropriate source attribution and without database storage/reuse; it does not resolve this site's custom-map case. No general caching TTL or explicit custom-WebGL permission was confirmed for either Kakao routing product. [Staff answer](https://devtalk.kakao.com/t/fairmeet/152280)

## External-link fallback

Google Maps URLs need **no API key** and can open the provider's directions UI using `https://www.google.com/maps/dir/?api=1&origin=...&destination=...`. That is an external navigation link, **not** a geometry API, and does not resolve South Korean mode coverage. [Maps URLs guide](https://developers.google.com/maps/documentation/urls/get-started)

Until an API and its custom-map usage are confirmed, retain the site's schematic connection and describe it as a location connection rather than an actual driving/walking route. No routing client or dependency was added as part of this research.
