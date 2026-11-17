# Kakao 자동차 길찾기 연결

확인일: **2026-11-15**. 사용 제품은 **Kakao Mobility 자동차 길찾기 REST API**입니다. 카카오맵 JavaScript 지도 SDK나 카카오 로그인은 사용하지 않습니다.

## API 키 발급

1. [Kakao Developers](https://developers.kakao.com/)에 로그인하고 우측 상단 **앱 → 앱 생성**으로 이동합니다.
2. 앱 이름(예: `Korea Travel`), 회사명 등 필수 정보를 실제 서비스 정보에 맞게 입력합니다. 대표 도메인은 `https://shawnai.win`입니다.
3. 생성한 앱에서 **앱 → 플랫폼 키 → REST API 키**를 엽니다. 기본 키를 사용하거나 서버용 REST API 키를 추가하고 서비스 정보를 저장합니다.
4. **REST API 키** 값을 복사합니다. JavaScript 키, 어드민 키, 클라이언트 시크릿과 구분해야 합니다. 자동차 API는 `Authorization: KakaoAK <REST API 키>`로 인증합니다. [공식 시작 가이드](https://developers.kakaomobility.com/guide/navi-api/start.html), [인증 규격](https://developers.kakaomobility.com/guide/navi-api/directions.html)

REST 키의 클라이언트 시크릿은 카카오 로그인·비즈니스 인증의 토큰 발급을 보호하는 별도 설정입니다. 이 연결을 위해 비활성화하거나 키 대신 복사할 필요가 없습니다. **호출 허용 IP 주소**를 제한한다면 브라우저 방문자의 IP가 아닌, Kakao를 호출하는 서버의 공인 송신 IP를 등록합니다. 현재 서버는 이 Mac의 로컬 Worker이므로 네트워크가 바뀌면 공인 IP도 달라질 수 있습니다. [앱 키·호출 IP 설정](https://developers.kakao.com/docs/ko/app-setting/app)

일반 자동차 길찾기는 무료 쿼터 안에서 별도 제휴 없이 이용할 수 있다는 담당자 안내가 있습니다. 현재 일일 무료 제공량은 **10,000건**이며, 무료량 초과 유료 전환은 별도 제휴 대상입니다. 이 작업은 결제·유료 제휴를 신청하지 않습니다. [공식 쿼터·가격](https://developers.kakaomobility.com/price/), [담당자 답변](https://devtalk.kakao.com/t/directions-api-navigation-api/149487)

## 이 서버에 키 등록

실제 키는 채팅, Git, `.env.example`, `NEXT_PUBLIC_*` 변수, 브라우저 코드에 넣지 않습니다. 공개 사이트를 제공하는 Worker는 아래 외부 파일을 읽도록 구성합니다.

```text
/Users/shawn/.config/ktravel/kakao.env
```

파일에 다음 한 줄을 저장합니다. 아래 설명 부분만 발급받은 값으로 바꿉니다.

```dotenv
KAKAO_MOBILITY_REST_API_KEY=발급받은_REST_API_키
```

디렉터리는 사용자만 접근 가능한 `700`, 파일은 `600` 권한을 유지합니다. 키를 파일에 저장한 후 서버를 재시작하면 반영되며, 키 변경만으로 프런트엔드를 다시 빌드할 필요는 없습니다.

```sh
chmod 700 /Users/shawn/.config/ktravel
chmod 600 /Users/shawn/.config/ktravel/kakao.env
launchctl kickstart -k gui/$(id -u)/com.kiseyno.ktravel
```

현재 사이트는 Cloudflare 원격 Worker에 배포한 형태가 아니라, 이 Mac의 Wrangler 로컬 Worker를 공개 프록시로 연결합니다. 따라서 원격 `wrangler secret put`만 실행해도 이 로컬 프로세스에는 전달되지 않습니다.

Wrangler의 기본 `.env`·`.dev.vars` 탐색 기준은 설정 파일 디렉터리입니다. 이 프로젝트의 실행 설정은 `dist/server/wrangler.json`이므로 비밀 파일을 `dist`로 복사하지 않고 **절대 경로 `--env-file`** 인자로 전달합니다. 설치된 Wrangler **4.92.0**의 도움말과 임시 Worker 실행에서 이 방식으로 서버 `env` 바인딩이 전달됨을 확인했습니다. [Cloudflare 비밀 변수 가이드](https://developers.cloudflare.com/workers/local-development/environment-variables/), [Wrangler 전역 옵션](https://developers.cloudflare.com/workers/wrangler/commands/workers/)

## 동작과 확인

- 카드 상세 화면에서 Departure를 선택하면 브라우저가 `GET /ktravel/directions/<카드 ID>?origin=<출발지 ID>`를 호출합니다. 기본값은 서울역이며 종로1가·신촌역·강남역·양재역도 선택할 수 있습니다. 서버 설정의 별도 기본 출발지도 유지합니다. 목적지는 DB의 공개 카드에 저장된 검증된 좌표에서만 읽습니다. [좌표와 검증](DEPARTURE_SELECTION_0_3_3.md)
- 서버가 `GET https://apis-navi.kakaomobility.com/v1/directions`를 호출합니다. 실제 도로 좌표와 거리·예상 이동시간을 반환하고 현재 선택 화면에서 표시합니다. 출발지는 공유된 허용 목록 ID로만 선택하며 임의 좌표를 외부 입력으로 받지 않습니다.
- 시간은 **조회 시점의 자동차 예상 이동시간**입니다. 주차 탐색·도보 이동·예약된 여행일의 교통 상황까지 포함하는 시간이 아닙니다. [자동차 API](https://developers.kakaomobility.com/guide/navi-api/directions.html)
- 키가 없으면 `missing_key`, 유효한 경로가 없으면 `no_route`, 호출 제한은 `rate_limited`, 공급자 오류는 `upstream_error`로 구분합니다. 실패 상태에서 실제 경로·이동시간을 추정해서 채우지 않습니다.
- 응답은 `Cache-Control: no-store`이며 도로 좌표와 이동시간을 활동 DB에 영구 저장하지 않습니다. 동시 요청 중복만 합치고 완료된 공급자 응답을 서버에 보관하지 않습니다.

서버 재시작 후 공개 사이트의 카드를 선택하고 Network 탭에서 해당 요청이 `status: "ok"`, `provider: "kakao"`, 도로 좌표 배열과 초·미터 값을 반환하는지 확인합니다. 예시 JSON을 실제 응답으로 오인하지 않도록 이 문서에는 꾸며낸 이동시간을 싣지 않습니다.

## 표시 출처와 확인되지 않은 범위

화면에는 **Kakao Mobility**를 경로 출처로 표시합니다. 담당자는 지도 없는 실시간 시간·거리 표시를 출처 표기 및 DB 저장·재사용 없이 이용하는 사례를 허용했습니다. 다만 그 답변은 이 사이트의 **자체 WebGL 지도 위 도로 선 표시**를 명시적으로 다루지 않으므로, 해당 사례만으로 모든 지도 표시 권한을 확인했다고 단정할 수는 없습니다. 공개 문서에서 일반 경로 캐시 TTL도 확인하지 못해 영구 저장과 완료 응답 캐시를 도입하지 않았습니다. [담당자 답변과 적용 범위](https://devtalk.kakao.com/t/fairmeet/152280)

이 문서 작성 과정에서는 계정·앱·키를 생성하거나 실제 키로 API를 호출하지 않았습니다. 유효한 키를 등록한 이후의 실제 공급자 응답 확인은 별도로 필요합니다.


## 실제 연결 확인 — 2026-11-16

사용자가 제공한 REST API 키를 외부 서버 비밀 파일에 등록하고 런타임을 재시작했습니다. 키 값은 이 문서·Git·브라우저 번들에 기록하지 않았습니다. 실제 Kakao 요청과 공개 `/ktravel/directions/food-samwon-garden`, `/ktravel/directions/history-deoksugung`에서 `200 / ok / kakao`를 확인했습니다. 삼원가든 응답은178개 도로 좌표, 덕수궁은72개였습니다. 이동시간은 조회 시점의 예상값이며 고정 일정값으로 저장하지 않습니다.

실제 호출 중 Workers가 표준 Fetch의 `redirect: error`를 지원하지 않는 문제를 발견했습니다. `manual`로 바꾸고 모든3xx를 명시적으로 거부해, 리다이렉트 대상에 인증키를 전달하지 않으면서 정상 요청이 실행되도록 수정했습니다. 공식 Workers 런타임 프로브로 원인을 재현했고 HTTP 재생 테스트와 리다이렉트 미추적 회귀 테스트를 통과했습니다. [Cloudflare Request 문서](https://developers.cloudflare.com/workers/runtime-apis/request/)


## 로컬 개발 서버도 같은 키 사용 — 2026-11-16 수정

공개4330Worker는 외부env파일을 읽지만,3000Vite개발서버는 이를 자동으로 읽지 않아 `503 missing_key`가 재현됐습니다. 프로젝트의 무시된 `.dev.vars`를 `/Users/shawn/.config/ktravel/kakao.env`에 연결해 같은 서버 비밀 파일을 사용하도록 했습니다. 값은 복사하지 않고,Git에 추가하지 않습니다. Cloudflare개발플러그인이 시작할 때 해당 비밀변수를 읽으므로 개발서버도 재시작했습니다.

새 체크아웃에서 같은 외부 비밀 파일을 사용할 때 `.dev.vars`가 없다면 아래 연결을 만든 뒤 `npm run dev`로 시작합니다. 이미 `.dev.vars`가 있다면 기존 설정을 덮어쓰지 말고 확인해야 합니다.

```sh
ln -s /Users/shawn/.config/ktravel/kakao.env .dev.vars
npm run dev
```

두 실행 환경을 함께 검증하는 명령은 `npm run check:routes`입니다. 로컬/공개 카드의 실제 요청 URL로 조회하여200,카카오 출처,도로좌표,거리/시간을 검사합니다. 유효한 키와 두 서버가 필요하며 각 실행은 실제 카카오 쿼터를 사용합니다. 수정 전 로컬503을 재현했고, 수정 후 양쪽 모두 통과했습니다.

## 택시 예상 요금과 통행료 — 2026-11-16

자동차 응답의 `summary.fare.taxi`와 `summary.fare.toll`은 각각 원 단위 택시 요금과 통행료입니다. 같은 자동차 조회에서 읽으며 추가 요청은 하지 않습니다. 공개 응답은 `taxiFareKrw: number | null`, `tollFareKrw: number | null`로 제공합니다. 값이 없거나 숫자가 아닌 값·음수·소수·안전한 정수 범위 밖의 값이면 해당 필드만 `null`로 두고 정상 도로·시간 결과를 유지합니다. `0`은 실제 숫자로 보존합니다. [공식 자동차 응답 규격](https://developers.kakaomobility.com/guide/navi-api/directions.html)

택시 값은 공급자가 제공한 예상 요금이며 예약·호출 또는 최종 결제액이 아닙니다. 택시 요금과 통행료를 임의로 합산하거나, 공급자 값이 없는 요금을 거리로 계산하지 않습니다.

## 지하철·버스 경로 — 2026-11-16

Mobility 자동차 API와 별도로, 같은 Kakao REST 키로 인증하는 **KakaoMap REST 대중교통 API** `GET https://dapi.kakao.com/v2/routing/publictraffic`가 있습니다. `start_x/start_y/end_x/end_y`와 `input_coord/output_coord=WGS84`를 사용합니다. `BUS`, `SUBWAY`, `BUS_AND_SUBWAY` 경로의 초 단위 시간, 미터 단위 거리, 환승 수와 원 단위 요금을 반환합니다. [공식 대중교통 요청·응답](https://developers.kakao.com/docs/ko/kakaomap/rest-api#대중교통-경로-조회)

이 API는 앱의 KakaoMap 사용 설정과 별도 무료 쿼터 조건이 적용됩니다. 첫 조회는 `403`이었고, 사용자가 승인한 무료 설정 활성화 후 같은 키로 서울역→덕수궁 요청이 `200 / OK`로 성공했습니다. 15개 후보에 세 종류가 모두 포함됐으며 직접 대중교통 조회는 약 1.04초, 새 어댑터의 자동차+대중교통 전체 조회는 약 2.64초였습니다. 결제·유료 API 설정이나 새 키·계정은 추가하지 않았습니다. 활성화 상태만으로 무료 사용량 초과가 허용된다고 간주하지 않습니다. [활성화와 무료 쿼터 적용 조건](https://developers.kakao.com/docs/ko/kakaomap/common#사용-방법)

공개 `DrivingRoute`에는 `transitOptions`, `transitStatus`, `transitMessage`를 추가합니다. 각 옵션은 `{ mode: 'bus' | 'subway' | 'bus_and_subway', durationSeconds, distanceMeters, fareKrw: number | null, transfers: number | null }`입니다. 한 번의 대중교통 호출로 반환된 후보 중 각 종류의 가장 빠른 경로 하나만 선택하며, 그 경로에 실제 제공된 요금만 사용합니다. 다른 후보의 요금이나 별도의 예상 시간을 섞지 않습니다. 없는 종류는 만들지 않고, 모르는 요금·환승 수는 `null`로 둡니다.

자동차가 성공한 뒤 대중교통을 최대 4초 동안 조회하되 두 공급자 조회를 합쳐 8초 안에서만 기다립니다. 초기 2초 제한은 간헐적인 공급자 지연 때 정상 대중교통 응답을 버릴 수 있어 늘렸으며, 전체 8초 제한과 정상 자동차 결과 보존은 유지합니다. 대중교통의 권한 거부·조회 실패·시간 초과·쿼터 제한은 `transitStatus`와 고정된 안전 문구로 구분하고, 정상 자동차·택시 결과는 유지합니다. 자동차와 대중교통 합계가 isolate당 분당 20회·동시 공급자 요청 4개를 넘지 않도록 제한합니다. 동시 시청자의 진행 중 요청만 공유하며 완료된 경로·요금은 캐시하거나 DB에 저장하지 않습니다.
