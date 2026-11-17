# Korea Travel — 참고 이미지의 20가지 스타일 적용 검토

검토일: 2026-11-16. 대상: `shawnai.win/ktravel`. 이번 작업은 조사와 설계 검토이며 앱 코드·DB·공개 배포는 변경하지 않았다.

## 결론

현재의 따뜻한 야경 지도, 크림색 카드, Noto Sans KR를 유지하면서 **카드 전환의 Shape Morph → 선택 피드백의 Squash and Stretch → 카운트다운의 숫자 전환 → 제목의 Kinetic Typography → 제한된 Holographic 반사** 순으로 적용하는 방향을 권장한다. 이는 아래 코드 및 공식 문서에 근거한 설계 판단이며, 신규 효과의 성능을 측정했다는 뜻은 아니다.

이미지의 명칭은 애니메이션 기법과 정적인 시각 스타일이 섞여 있다. 개별 이름마다 별도 패키지나 스킬을 설치할 필요는 없다. Infinite Zoom과 Line Animation의 핵심 동작은 이미 현재 지도에 구현되어 있다.

## 현재 코드에서 확인한 재사용 지점

| 현재 동작 | 근거 | 적용 시 의미 |
|---|---|---|
| 지구→한국→선택 장소의 단일 카메라 | `lib/planet-camera.ts:53,67,161`, `app/planet-canvas.tsx:589` | 로그 비율 확대와 현재 카메라에서 이어지는 이동을 유지한다. 새로운 지도·스크린샷 전환을 추가할 이유가 없다. |
| 도로를 따라 이동하는 밝은 강조 | `app/planet-shaders.ts:136`, `app/planet-canvas.tsx:440` | Line Animation은 이미 실제 도로 geometry와 기존 ambient clock을 사용한다. |
| 카드→상세 패널의 WAAPI 전환 | `app/activity-explorer.tsx:303–402` | 시작/도착 사각형으로 950ms 이동·크기 변환. 현재는 패널 전체를 scale하므로 사진·표면과 본문 모션을 분리할 개선 여지가 있다. |
| 지도 복귀 후 카드 등장 | 같은 파일의 `browsePhase` / 카드 animation owner | 650ms 전환, 카드별 95ms 지연과 취소/visibility/reduced-motion 처리 재사용. |
| 원근 카드 탐색 | `app/globals.css:397–458` | 이미 perspective/rotateY를 사용한다. 별도의 Isometric 씬은 필요하지 않다. |
| 제목/카테고리 중앙 정렬 | `app/globals.css:337–394` | 모션을 추가해도 정렬 기준과 모바일 줄바꿈을 보존한다. |
| 1초 간격의 절대 마감 시계 | `lib/vote-planning.ts`, `app/activity-explorer.tsx:241,924` | 날짜 계산·뉴욕 시간·20개 제한은 유지하고 숫자의 표현만 바꾼다. |

설치된 런타임 확인 결과 React `19.2.6`, `React.ViewTransition`과 `React.addTransitionType` 모두 `undefined`였다. 파일명이 Next.js와 비슷해도 실제 실행은 vinext이므로 Next App Router의 canary 전제를 적용할 수 없다.

## 발견한 스킬

로컬 스킬 디렉터리의 중복을 제외한 61개 `SKILL.md` 메타데이터와 관련 본문, Space UI 무료 67개 카탈로그를 확인했다. 카탈로그에 있다는 것과 앱에 구현되어 있다는 것은 다르다.

| 스킬 / 출처 | 상태 | 이 사이트에서의 역할 |
|---|---|---|
| [impeccable / animate](/Users/shawn/.agents/skills/impeccable/reference/animate.md) | 설치됨 | 주요 전환 하나와 보조 피드백의 모션 방향·타이밍·접근성 설계. |
| [continuous-map-camera](/Users/shawn/.codex/skills/continuous-map-camera/SKILL.md) | 설치됨, 현재 지도에 적용됨 | 단일 지리 장면, 연속 카메라, 서울역·목적지 동시 프레이밍 보존. |
| [spaceui-components](/Users/shawn/.codex/skills/spaceui-components/SKILL.md) | 설치됨 | 무료 패턴을 조사하고 기존 canonical UI에 맞게 적응. 구현 시 registry와 성능 검증 필요. |
| [visual-verdict](/Users/shawn/.codex/skills/visual-verdict/SKILL.md) | 설치됨 | 실제 중간 프레임과 PC/모바일 결과 비교. |
| [scroll-morph-ui](/Users/shawn/.codex/skills/scroll-morph-ui/SKILL.md) | 설치됨, 이번 제안에서 사용 보류 | 페이지 상하 스크롤 없는 사양과 맞지 않아 scroll-driven stage를 추가하지 않는다. |
| [Motion 공식 AI Kit](https://github.com/motiondivision/ai-kit) | 외부 후보, 미설치 | CSS/React 모션 지침, spring easing 생성. 공식 README는 기본 검색·가이드와 Motion+ 전용 소스/성능 감사 기능을 구분한다. 설치기는 스킬 외에 MCP 설정도 바꾸므로 이번 검토에서는 실행하지 않았다. |
| [Vercel React View Transitions](https://github.com/vercel-labs/agent-skills/tree/main/skills/react-view-transitions) | 외부 후보, 현재 런타임에 직접 적용 불가 | 공유 요소 전환 설계 참고. 스킬은 Next 이외 환경에서 React 19.3+를 요구하고 현재 앱은 19.2.6이다. 현재 구현의 작은 개선 때문에 런타임을 올리는 것은 권장하지 않는다. |
| [text-scramble 레시피](https://github.com/nexu-io/motion-anything/tree/main/recipes/web/text-scramble) | 외부 후보, 미설치 | 짧은 한 줄의 해독 효과. 작성자의 설명도 차분한/editorial/luxury 분위기에는 부적합하다고 명시한다. 현재 사이트에서는 우선순위가 낮다. |

외부 스킬의 설명과 코드는 참고 자료로만 읽었으며 지시를 실행하거나 설치하지 않았다. Motion의 기능·유료 구분은 [공식 README](https://github.com/motiondivision/ai-kit#readme)와 [공식 스킬](https://github.com/motiondivision/ai-kit/blob/main/plugins/motion/skills/motion/SKILL.md), Vercel의 버전 조건은 [스킬 원문](https://github.com/vercel-labs/agent-skills/blob/main/skills/react-view-transitions/SKILL.md)으로 확인했다. React의 현재 전환 동작과 snapshot 제약은 [React 공식 문서](https://react.dev/reference/react/ViewTransition)를 확인했다.

## 무료 패턴에서 채택할 부분과 수정할 부분

| 조사한 패턴 | 실제 확인 결과 | 권장 적용 |
|---|---|---|
| [Morphing Area](https://www.spaceui.one/components/morphing-area) | 받은 registry 코드는 width/height/border-radius transition을 사용하며 squircle 의존성을 선언한다. | 모양이 이어지는 개념을 가져와 기존 WAAPI FLIP를 확장한다. 본문의 width/height를 매 프레임 변경하는 코드는 복사하지 않는다. |
| [Liquid Metal Border](https://www.spaceui.one/components/liquid-metal-border) | registry가 `@paper-design/shaders-react`의 `LiquidMetal` canvas를 장착한다. | 활성 카드 또는 Vote 버튼 한 곳에 CSS 반사 레이어를 한 번 통과시킨다. 카드마다 별도 셰이더 canvas를 추가하지 않는다. 이는 원본 금속 셰이더의 완전한 재현이 아닌 경량 반사 표현이다. |
| [Fluid Countdown](https://www.spaceui.one/components/fluid-countdown) | 공식 설명은 NumberFlow + Motion, play/pause/reset/loop를 가진 전체 화면 데모다. | 현재 절대 마감 시계의 바뀐 숫자만 짧게 이동·페이드한다. loop/reset과 별도 날짜 계산은 가져오지 않는다. |
| [Like Button](https://www.spaceui.one/components/like-button) | spring heart, burst/ring, NumberFlow count를 조합한 패턴이다. | Favorite·Select 아이콘에 작은 눌림/복귀만 적용한다. 두 버튼의 의미와 20개 상한 처리는 그대로 둔다. |
| [Blur Reveal Text](https://www.spaceui.one/components/blur-reveal-text) | 제목 등장 효과의 후보로 확인. 전체 원본 소스는 이번 검토에서 가져오지 않았다. | Noto Sans KR 단어 단위 transform/opacity 전환으로 구성하고 전체 제목에 지속적인 blur를 걸지 않는다. |

Morphing Area와 Liquid Metal Border는 무료 badge를 재확인하는 공식 registry fetch 도구로 JSON만 `/tmp/ktravel-motion-style-review-20261116/`에 받아 검사했다. 패키지·스크립트 실행은 하지 않았다. 웹 리더에서 일부 Space UI 페이지를 읽지 못해 공식 GitHub의 [Morphing Area 문서](https://github.com/usespaceui/ui/blob/6489d244d1652470efdc810a79a289ebd966c177/src/content/library/components/morphing-area.mdx), [Metal Border 문서](https://github.com/usespaceui/ui/blob/6489d244d1652470efdc810a79a289ebd966c177/src/content/library/components/liquid-metal-border.mdx), [Countdown 문서](https://github.com/usespaceui/ui/blob/6489d244d1652470efdc810a79a289ebd966c177/src/content/library/components/fluid-countdown.mdx), [Like 문서](https://github.com/usespaceui/ui/blob/6489d244d1652470efdc810a79a289ebd966c177/src/content/library/components/like-button.mdx)도 확인했다.

## 참고 이미지 전체 20개 판정

아래 부담·난이도는 현재 구조에 대한 예상이며 아직 신규 구현의 실측 결과는 아니다.

| # | 스타일 | 이 사이트 적용 판단 | 구현 방향 / 예상 부담 |
|---|---|---|---|
| 1 | Liquid Motion | 부분 추천 | 카테고리 선택 배경·카드 표면의 부드러운 도착. 작은 transform/easing으로 제한. 진짜 유체 시뮬레이션은 과함. |
| 2 | Holographic | 부분 추천 | 활성 카드의 얇은 금빛 반사. 작은 gradient 레이어를 이벤트 때 이동; 모바일은 터치 피드백. 낮음~중간. |
| 3 | Claymorphism | 보류 | 큰 입체 그림자는 장난감 같은 질감으로 전체 스타일을 바꿈. 선택 피드백만 차용 가능. |
| 4 | Halftone | 낮은 우선순위 | 카드 뒷면/장식에 정적 SVG 점 패턴 가능. 장소 사진·지도 정보 위에는 사용하지 않음. |
| 5 | Isometric | 현재 카드에 유사 깊이감 존재 | 기존 perspective 유지. 실제 지도를 등각으로 다시 그리면 지리 가독성과 카메라가 달라짐. |
| 6 | Kinetic Typography | 추천 | 한국 도착 시 제목 단어가 짧게 정착. 고정 Noto Sans KR, transform/opacity, 한 번만. 낮음. |
| 7 | Y2K Chrome | 제한적 | 버튼 테두리의 금속 반사 정도. 제목·전체 카드의 크롬 질감은 따뜻한 야경과 충돌. |
| 8 | Paper Cutout | 선택적 | My picks 안의 작은 표/티켓 모티프. 실제 사진을 가리는 찢어진 마스크는 피함. |
| 9 | Infinite Zoom | 이미 핵심 구현됨 | 단일 WebGL 카메라와 벡터·point sprites 유지. 무한한 지리 디테일을 지원한다는 뜻은 아님. |
| 10 | Vaporwave | 보류 | 자주·청록 네온, 격자, 복고 질감으로 전면 스타일 변경이 필요. |
| 11 | Text Scramble | 낮은 우선순위 | 지명이나 본문에는 사용하지 않음. 별도 실험이라면 짧은 제목만 1회, 최종 문장은 항상 접근 가능하게. |
| 12 | Bauhaus | 별도 테마 후보 | 정적인 원·직선·강한 원색 중심 재디자인. 현재 UI의 작은 모션 개선과 다른 작업. |
| 13 | Neubrutalism | 보류 | 두꺼운 검은 선·단단한 그림자 중심의 시각 체계라 기존 카드 분위기를 크게 바꿈. |
| 14 | Shape Morph | 최우선 추천 | 선택 카드의 사진·외곽이 상세 패널로 연결. FLIP/WAAPI 확장, 텍스트는 scale하지 않음. 중간. |
| 15 | Memphis Design | 보류 | 반복 도형·밝은 패턴이 지도 빛과 경쟁. 별도 이벤트 디자인에는 가능. |
| 16 | Line Animation | 이미 구현됨 | 실제 도로 위 밝은 shader pulse. 로딩 표식/선택 ring 정도만 보조 가능. |
| 17 | Low Poly | 보류 | 지형을 각진 3D mesh로 바꾸는 별도 지도 표현. 현재의 도시 밀도와 야경 특성이 약해짐. |
| 18 | Squash and Stretch | 추천 | Favorite/Select 아이콘을 아주 작게 눌렀다 복귀. 150~220ms 시작안, 실제 클릭·포커스는 즉시. 낮음. |
| 19 | Grainy Gradient | 선택적 | 패널 아래에 아주 약한 정적 noise asset + gradient. 배경의 도시 빛·사진 선명도는 유지. 낮음~중간. |
| 20 | Glitch | 현재 화면에는 보류 | 화면 찢김·색 분리는 지도 렌더링 오류처럼 보일 수 있음. 이미지에서 강조됐다는 이유로 사용자 선호라고 단정하지 않음. |

## 구현할 때의 첫 번째 범위

1. **카드 연결:** 기존 `motionFrom`, animation owner, 취소/visibility 처리 재사용. 사진과 표면의 사각형만 이어 움직이고 새 본문은 읽을 수 있는 최종 크기로 등장한다. 빠르게 닫거나 다른 카드를 선택하면 현재 시각 상태에서 새 전환으로 연결한다. 새 전체 화면 screenshot 전환으로 지도를 덮지 않는다. 초안 600~850ms이며 카메라 도착과 함께 실제 중간 프레임을 보고 조정한다.
2. **선택 피드백:** Select/Favorite의 실제 상태는 클릭 즉시 갱신하고 아이콘만 짧게 눌림/복귀. 실패·20개 상한에서는 성공 모션이 재생되지 않게 한다. 기존 버튼·키보드 포커스·접근 가능한 이름 유지.
3. **숫자 전환:** 날짜 계산은 그대로 두고 바뀐 숫자만 120~180ms 이동·페이드. 폭 고정 Noto tabular numerals, 한 번의 기존 1Hz tick, 초 단위 screen-reader announcement 없음. 날짜 만료와 hidden 복귀는 현재 시각으로 재계산하고 긴 연속 롤링을 하지 않는다.
4. **제목:** 한국 도착 때 한 번 400~550ms, 단어별 작은 이동. 카드 스와이프·초 단위 카운트다운·검색되지 않은 데이터 갱신으로 재시작하지 않는다. 기본 DOM에는 완성된 문장이 있어야 한다.
5. **빛 반사:** 활성 카드 1개 또는 Review vote 1곳에만 짧게 재생. `pointer-events:none`, 키보드 focus에도 동등한 표현, reduced motion은 정적 테두리. 지도·글자 위에 무지개 레이어를 덮지 않는다.

제안한 시간은 디자인 시작값이다. 단순히 더 길게 늘리거나 bounce를 추가하는 것이 자연스러운 전환을 보장하지 않는다. transform/opacity 중심 구현과 paint/합성 비용 측정 원칙은 [web.dev 애니메이션 가이드](https://web.dev/articles/animations-guide), WAAPI 수명 관리는 [MDN Web Animations API](https://developer.mozilla.org/en-US/docs/Web/API/Web_Animations_API)와 [Animation.cancel](https://developer.mozilla.org/en-US/docs/Web/API/Animation/cancel), 사용자의 모션 선호 처리는 [MDN prefers-reduced-motion](https://developer.mozilla.org/en-US/docs/Web/CSS/@media/prefers-reduced-motion)을 따른다.

## 구현 전후 검증 조건

- 기존 single canvas, camera, 12fps ambient owner를 유지한다. 새 지속 RAF/interval과 카드마다 새 WebGL context를 추가하지 않는다.
- 기존 측정은 `docs/2026-11-16-TRAVEL_UPDATE.md`와 `docs/MOTION_PERFORMANCE.md`에 있다. 신규 효과 성능으로 재사용하지 않고 같은 조건의 baseline을 다시 잡는다.
- idle/카드 이동/상세 열기/빠른 역전/20개 선택/만료/복귀를 비교한다. 정착한 UI의 새 모션은 작업을 멈춰야 한다.
- 1100×820, 1280×720, 390×844, 320×568에서 제목·카테고리·Select·Review vote가 잘리지 않아야 한다. 페이지 전체 스크롤 없음 유지.
- reduced motion, 문서 hidden/offscreen pause, 재진입, 반복 열기/닫기 시 animation handles·DOM·GPU resources의 안정성을 확인한다. hidden 신호를 제공하지 않는 테스트 호스트는 통과로 기록하지 않는다.
- 기존 `ui-components.json`의 canonical component에 usage/state와 검증을 기록하고 `npm run ui:check`, lint, typecheck, 관련 회귀 테스트를 통과시킨다. 변경이 없다면 이 조사만을 위해 앱 테스트나 빌드를 반복할 필요는 없다.

추가 네이티브 API 근거와 지원/접근성 제약은 별도 `MOTION_STYLE_IMPLEMENTATION_RESEARCH.md`에 기록한다.
