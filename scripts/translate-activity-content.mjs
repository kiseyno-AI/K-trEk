import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { pathToFileURL } from 'node:url';
import { parseActivity } from '../lib/activities.ts';

const hangul = /[\uac00-\ud7a3\u3131-\u318e\u1100-\u11ff]/;
const quote = (value) => `'${String(value).replaceAll("'", "''")}'`;
const originalPrefix =
  '사용자가 제공한 조사 자료에서 가져왔습니다. 연결 페이지·영업 현황·예약 조건은 이번 가져오기에서 독립적으로 확인하지 않았습니다. 날짜별 예약, 실제 좌표, 차량 경로, Google 평점·리뷰 수·Place ID, 이미지 재사용 권한은 미확인입니다. ';
const originalSuffix =
  ' Google Maps와 YouTube 검색 링크는 장소명으로 생성한 탐색 링크이며 실제 Place ID·평점·관련 영상 검증이 아닙니다.';
export const PHOTO_CREDIT_TRANSLATIONS = {
  문화재청: 'Cultural Heritage Administration',
  오모군: 'Omogun',
  서울연구원: 'Seoul Institute',
  슐라: 'Syulla',
  책읽는달팽: 'Chaekikneundalpaeng',
  서울연구데이터서비스: 'Seoul Research Data Service',
  '서울특별시 소방재난본부(Seoul Metropolitan Fire & Disaster Headquarters)':
    'Seoul Metropolitan Fire & Disaster Headquarters',
};

// Exact original values protect later admin edits; source-photo appendices are preserved.
export const ORIGINAL_CONTENT = [
  {
    id: 'food-samwon-garden',
    name_ko: '삼원가든',
    fields: {
      duration_notes:
        '사용자가 제공한 계획용 체류시간 90–120분. 운영사 프로그램 시간이나 여행일 확정 일정과 구분합니다.',
      booking_notes:
        '네이버 예약·전화. 공식 4~12인 룸이 있어 10명 규모의 시설 근거가 있습니다. 해당일 룸·테이블 배치·룸차지는 확인해야 합니다.',
      group_simultaneous_use:
        '공식 룸 정원은 4~12명입니다. 10인 룸·테이블 배치와 날짜별 이용은 미확정입니다.',
    },
  },
  {
    id: 'food-hanilkwan-apgujeong',
    name_ko: '한일관 압구정본점',
    fields: {
      duration_notes:
        '사용자가 제공한 계획용 체류시간 90–120분. 운영사 프로그램 시간이나 여행일 확정 일정과 구분합니다.',
      booking_notes:
        '공식 지점 안내의 예약 문의 경로 이용. 10인 동석·룸 정원은 별도 문의입니다.',
      group_simultaneous_use: '10인 동석·룸 정원 별도 문의',
    },
  },
  {
    id: 'food-korea-house',
    name_ko: '한국의집 궁중음식 다이닝',
    fields: {
      duration_notes:
        '사용자가 제공한 계획용 체류시간 120–150분. 운영사 프로그램 시간이나 여행일 확정 일정과 구분합니다.',
      booking_notes:
        '캐치테이블·전화. 10인 룸과 메뉴 조건을 문의해야 합니다. 고호재 다과와 다른 상품입니다.',
      group_simultaneous_use: '10인 룸·메뉴 조건 문의; 고호재 다과 상품과 구분',
    },
  },
  {
    id: 'food-byeokje-galbi-bangi',
    name_ko: '벽제갈비 방이본점',
    fields: {
      duration_notes:
        '사용자가 제공한 계획용 체류시간 90–120분. 운영사 프로그램 시간이나 여행일 확정 일정과 구분합니다.',
      booking_notes:
        '운영사가 CATCHTABLE Global에 직접 연결합니다. 공식 안내는 30일 이내 온라인 예약, 3개월 이내 이메일 문의입니다. 10인 룸·동석은 미확인입니다.',
      group_simultaneous_use: '10인 룸·동석 미확인',
    },
  },
  {
    id: 'food-balwoo-gongyang',
    name_ko: '발우공양',
    fields: {
      duration_notes:
        '사용자가 제공한 계획용 체류시간 90–120분. 운영사 프로그램 시간이나 여행일 확정 일정과 구분합니다.',
      booking_notes:
        '운영기관이 공식 홈페이지·전화·네이버 예약을 안내합니다. 10인 좌석과 개인별 식이 요청은 문의해야 합니다. 예약 안내 근거는 2025년 자료이므로 방문일 정책을 다시 확인해야 합니다.',
      group_simultaneous_use: '10인 좌석과 개인별 식이 요청 문의',
    },
  },
  {
    id: 'food-jin-jin',
    name_ko: '진진',
    fields: {
      duration_notes:
        '사용자가 제공한 계획용 체류시간 90–120분. 운영사 프로그램 시간이나 여행일 확정 일정과 구분합니다.',
      booking_notes:
        '공식 카카오채널로 예약 문의. 미쉐린도 식당 직접 예약을 안내합니다. 10인 좌석과 실제 배정 공간을 확인해야 합니다.',
      group_simultaneous_use: '10인 좌석과 실제 배정 공간 확인 필요',
    },
  },
  {
    id: 'food-born-and-bred',
    name_ko: '본앤브레드 서울 신관',
    fields: {
      duration_notes:
        '사용자가 제공한 계획용 체류시간 120–180분. 운영사 프로그램 시간이나 여행일 확정 일정과 구분합니다.',
      booking_notes:
        '글로벌 캐치테이블. 프라이빗룸은 있으나 10인 룸 수용은 확인되지 않았습니다. 층·코스·좌석을 함께 문의해야 합니다.',
      group_simultaneous_use: '프라이빗룸 있음; 10인 룸 수용 미확인',
    },
  },
  {
    id: 'food-bicena',
    name_ko: '비채나',
    fields: {
      duration_notes:
        '사용자가 제공한 계획용 체류시간 120–180분. 운영사 프로그램 시간이나 여행일 확정 일정과 구분합니다.',
      booking_notes:
        '시그니엘 공식 예약 안내. 공식 4~12인 룸 안내가 있습니다. 룸 조건과 최소소비, 식이 제한 대응을 확인해야 합니다.',
      group_simultaneous_use:
        '공식 룸 정원 4~12명; 룸 조건·최소소비·식이 제한 대응 확인 필요',
    },
  },
  {
    id: 'food-samcheonggak',
    name_ko: '삼청각 한식당',
    fields: {
      duration_notes:
        '사용자가 제공한 계획용 체류시간 90–150분. 운영사 프로그램 시간이나 여행일 확정 일정과 구분합니다.',
      booking_notes:
        '공식 예약 안내·전화. 룸 최소 6인 조건이 있지만, 이것만으로 10인 룸이 확정되지는 않습니다. 룸별 정원과 메뉴 조건을 문의해야 합니다.',
      group_simultaneous_use:
        '룸 최소 6명은 10인 수용 근거가 아님; 룸별 정원·메뉴 문의',
    },
  },
  {
    id: 'food-hwa-hae-dang',
    name_ko: '화해당 여의도점',
    fields: {
      duration_notes:
        '사용자가 제공한 계획용 체류시간 60–90분. 운영사 프로그램 시간이나 여행일 확정 일정과 구분합니다.',
      booking_notes:
        '식당 직접 전화 02-785-4422 우선. 미쉐린이 직접 예약을 안내합니다. 10인 동석과 일행의 생해산물 선호를 확인해야 합니다.',
      group_simultaneous_use: '10인 동석과 생해산물 선호 확인 필요',
    },
  },
  {
    id: 'history-gyeongbokgung',
    name_ko: '경복궁',
    fields: {
      duration_notes:
        '사용자가 제공한 계획용 체류시간 90–150분. 운영사 프로그램 시간이나 여행일 확정 일정과 구분합니다.',
      booking_notes:
        '외국어 해설은 10명부터 사전 전화예약이 필요합니다. 일반 입장권과 해설예약을 구분합니다.',
      group_simultaneous_use:
        '외국어 해설 10명부터 사전 전화예약; 입장권과 별개',
    },
  },
  {
    id: 'history-changdeokgung',
    name_ko: '창덕궁과 후원',
    fields: {
      duration_notes:
        '사용자가 제공한 계획용 체류시간 120–180분. 운영사 프로그램 시간이나 여행일 확정 일정과 구분합니다.',
      booking_notes:
        '후원은 시간대 예약입니다. 1회 예약 최대 10매지만 같은 회차 10석 확보 여부는 별도입니다. 궁궐 입장권도 필요합니다.',
      group_simultaneous_use:
        '1회 최대 10매는 같은 회차 10석 확보 보장이 아님; 궁궐 입장권 별도',
    },
  },
  {
    id: 'history-bukchon',
    name_ko: '북촌한옥마을',
    fields: {
      area_description:
        '북촌한옥마을 관람·산책 지역 (Jongno, Seoul). 세부 출발·합류·종료 지점은 일정 편성 시 정해야 합니다.',
      duration_notes:
        '사용자가 제공한 계획용 체류시간 45–90분. 운영사 프로그램 시간이나 여행일 확정 일정과 구분합니다.',
      booking_notes:
        '레드존 관광시간은 10~17시입니다. 주민 생활공간과 관광 제한구역, 전세버스 제한을 반영해야 합니다.',
    },
  },
  {
    id: 'history-jongmyo',
    name_ko: '종묘',
    fields: {
      duration_notes:
        '사용자가 제공한 계획용 체류시간 60–90분. 운영사 프로그램 시간이나 여행일 확정 일정과 구분합니다.',
      booking_notes:
        '시간제 관람일에는 10명부터 예약 필수입니다. 자유관람일과 구분해서 카드에 표시해야 합니다.',
      group_simultaneous_use:
        '시간제 관람일 10명부터 예약 필수; 자유관람일 별도',
    },
  },
  {
    id: 'history-suwon-hwaseong',
    name_ko: '수원화성',
    fields: {
      area_description:
        '수원화성 성곽 산책 구간. 화성행궁·유료 체험은 별도이며 정확한 산책 시작·종료 지점은 미정입니다.',
      duration_notes:
        '사용자가 제공한 계획용 체류시간 120–210분. 운영사 프로그램 시간이나 여행일 확정 일정과 구분합니다.',
      booking_notes:
        '근교 조건부. 성곽 산책과 화성행궁·유료 체험을 구분합니다. 선택한 출발 숙소와 시간의 차량 경로 확인이 필요합니다.',
    },
  },
  {
    id: 'history-korean-folk-village',
    name_ko: '한국민속촌',
    fields: {
      duration_notes:
        '사용자가 제공한 계획용 체류시간 180–300분. 운영사 프로그램 시간이나 여행일 확정 일정과 구분합니다.',
      booking_notes:
        '근교 조건부. 공개 단체 기준은 15명입니다. 10명은 개인표 기준으로 계획하고, 체험 프로그램은 별도로 확인합니다.',
      group_discount: '공개 단체 기준 15명; 10명은 개인표 기준',
    },
  },
  {
    id: 'history-war-memorial',
    name_ko: '전쟁기념관',
    fields: {
      duration_notes:
        '사용자가 제공한 계획용 체류시간 120–180분. 운영사 프로그램 시간이나 여행일 확정 일정과 구분합니다.',
      booking_notes:
        '영어·단체 해설을 원하면 별도 예약 조건을 확인해야 합니다. 일부 해설 중단 공지를 전체 시설 휴관으로 해석하면 안 됩니다.',
    },
  },
  {
    id: 'history-seodaemun-prison',
    name_ko: '서대문형무소역사관',
    fields: {
      duration_notes:
        '사용자가 제공한 계획용 체류시간 90–120분. 운영사 프로그램 시간이나 여행일 확정 일정과 구분합니다.',
      booking_notes:
        '단체 기준은 20명으로, 10명에는 해당하지 않습니다. 휴관일과 관람시간 확인이 필요합니다.',
      group_discount: '단체 기준 20명; 10명 해당 없음',
    },
  },
  {
    id: 'history-naksan-city-wall',
    name_ko: '한양도성 낙산구간',
    fields: {
      area_description:
        '한양도성 낙산구간: 혜화문~광희문 전체 3.2km, 종로~중구. 짧은 코스는 별도 일정으로 구분합니다.',
      duration_notes:
        '사용자가 제공한 계획용 체류시간 90–150분. 운영사 프로그램 시간이나 여행일 확정 일정과 구분합니다.',
      booking_notes:
        '자유 산책 후보입니다. 현재 공식 안내의 전체 구간은 혜화문~광희문 3.2km, 약 90분이며, 짧은 코스로 줄일 경우 별도 일정으로 표현해야 합니다.',
    },
  },
  {
    id: 'history-deoksugung',
    name_ko: '덕수궁',
    fields: {
      duration_notes:
        '사용자가 제공한 계획용 체류시간 60–120분. 운영사 프로그램 시간이나 여행일 확정 일정과 구분합니다.',
      booking_notes:
        '정규 해설은 10명부터 전화예약입니다. 평일·주말의 단체 참여 한도가 다릅니다.',
      group_simultaneous_use:
        '정규 해설 10명부터 전화예약; 평일·주말 단체 참여 한도 상이',
    },
  },
  {
    id: 'culture-national-museum',
    name_ko: '국립중앙박물관',
    fields: {
      duration_notes:
        '사용자가 제공한 계획용 체류시간 120–180분. 운영사 프로그램 시간이나 여행일 확정 일정과 구분합니다.',
      booking_notes:
        '상설전시는 무료입니다. 일반 성인 10명 방문과 학교단체 예약 기준을 혼동하지 않아야 합니다.',
    },
  },
  {
    id: 'culture-leeum',
    name_ko: '리움미술관',
    fields: {
      duration_notes:
        '사용자가 제공한 계획용 체류시간 90–150분. 운영사 프로그램 시간이나 여행일 확정 일정과 구분합니다.',
      booking_notes:
        '10명부터 온라인 단체예약 필수입니다. 전시별 요금과 예약 가능 날짜를 확인해야 합니다.',
      group_simultaneous_use:
        '10명부터 온라인 단체예약 필수; 전시별 요금·날짜 확인',
    },
  },
  {
    id: 'culture-ddp',
    name_ko: 'DDP 동대문디자인플라자',
    fields: {
      duration_notes:
        '사용자가 제공한 계획용 체류시간 60–120분. 운영사 프로그램 시간이나 여행일 확정 일정과 구분합니다.',
      booking_notes:
        '일반 공간 방문과 유료 전시·건축투어를 구분합니다. 방문일에 열리는 전시를 카드의 추가 정보로 연결하면 됩니다.',
    },
  },
  {
    id: 'culture-hikr-ground',
    name_ko: '하이커 그라운드',
    fields: {
      duration_notes:
        '사용자가 제공한 계획용 체류시간 60–90분. 운영사 프로그램 시간이나 여행일 확정 일정과 구분합니다.',
      booking_notes:
        '일반 입장은 무료입니다. 공개 자료의 단체예약 기준이 서로 달라 10인 방문 조건은 재확인 상태로 저장했습니다.',
      group_simultaneous_use:
        '공개 단체예약 기준 상충; 10인 방문 조건 재확인 필요',
    },
  },
  {
    id: 'culture-nanta-myeongdong',
    name_ko: '명동난타극장',
    fields: {
      duration_notes:
        '사용자가 제공한 계획용 체류시간 120–150분. 운영사 프로그램 시간이나 여행일 확정 일정과 구분합니다.',
      booking_notes:
        '같은 회차의 10석을 확보해야 합니다. 공식 단체혜택 기준은 15명부터입니다.',
      group_discount: '공식 단체혜택 15명부터; 10명 해당 여부와 별개',
      group_simultaneous_use: '같은 회차 10석 확보 필요',
    },
  },
  {
    id: 'culture-gugak-saturday',
    name_ko: '국립국악원 토요명품',
    fields: {
      duration_notes:
        '계획용 체류 110~140분과 사용자 제공 2026 시즌 공식 공연시간 80분을 구분합니다. 다른 연도는 새 시즌 일정 확인이 필요합니다.',
      booking_notes:
        '확인한 자료는 2026 시즌, 공연 80분입니다. 다른 연도 여행이라면 새 시즌 일정을 확인해야 합니다.',
    },
  },
  {
    id: 'culture-hanboknam',
    name_ko: '한복남 경복궁점',
    fields: {
      duration_notes:
        '사용자가 제공한 계획용 체류시간 120–180분. 운영사 프로그램 시간이나 여행일 확정 일정과 구분합니다.',
      booking_notes:
        '10명 피팅 시간, 사이즈, 대여시간과 반납시간을 지점에 사전 문의해야 합니다.',
      group_simultaneous_use:
        '10명 피팅 시간·사이즈·대여 및 반납시간 지점 사전 문의',
    },
  },
  {
    id: 'culture-ikseondong',
    name_ko: '익선동 한옥거리',
    fields: {
      area_description:
        '익선동 한옥거리 관람·산책 지역 (Jongno, Seoul). 세부 출발·합류·종료 지점은 일정 편성 시 정해야 합니다.',
      duration_notes:
        '사용자가 제공한 계획용 체류시간 60–120분. 운영사 프로그램 시간이나 여행일 확정 일정과 구분합니다.',
      booking_notes:
        '거리 탐방과 카페 예약은 별개입니다. 10인 카페 좌석을 확보한 것으로 표시하지 않습니다.',
      group_simultaneous_use: '거리 탐방만 해당; 10인 카페 좌석 미확보',
    },
  },
  {
    id: 'culture-bukchon-crafts',
    name_ko: '북촌전통공예체험관',
    fields: {
      duration_notes:
        '사용자가 제공한 계획용 체류시간 60–120분. 운영사 프로그램 시간이나 여행일 확정 일정과 구분합니다.',
      booking_notes:
        '10명 이상은 전화 협의가 필요합니다. 일반 온라인 예약은 1~7명입니다.',
      group_simultaneous_use: '10명 이상 전화 협의; 일반 온라인 예약 1~7명',
    },
  },
  {
    id: 'culture-mmca-seoul',
    name_ko: '국립현대미술관 서울',
    fields: {
      duration_notes:
        '사용자가 제공한 계획용 체류시간 90–150분. 운영사 프로그램 시간이나 여행일 확정 일정과 구분합니다.',
      booking_notes:
        '현재 국문 안내는 성인 단체예약 20명, 학생 10명 기준입니다. 전시별 요금도 확인해야 합니다.',
      group_discount: '성인 단체예약 20명, 학생 10명 기준을 구분',
    },
  },
  {
    id: 'nature-seoul-forest',
    name_ko: '서울숲',
    fields: {
      area_description:
        '서울숲 관람·산책 지역 (Seongsu, Seoul). 세부 출발·합류·종료 지점은 일정 편성 시 정해야 합니다.',
      duration_notes:
        '사용자가 제공한 계획용 체류시간 60–120분. 운영사 프로그램 시간이나 여행일 확정 일정과 구분합니다.',
      booking_notes:
        '일반 공원 산책은 무료입니다. 체험시설과 해설 프로그램은 별도 확인입니다.',
    },
  },
  {
    id: 'nature-seoul-botanic-park',
    name_ko: '서울식물원',
    fields: {
      duration_notes:
        '사용자가 제공한 계획용 체류시간 90–150분. 운영사 프로그램 시간이나 여행일 확정 일정과 구분합니다.',
      booking_notes:
        '온실·주제정원은 유료입니다. 단체요금 기준은 30명으로, 10명은 개인요금 기준입니다.',
      group_discount: '단체요금 30명부터; 10명은 개인요금',
    },
  },
  {
    id: 'nature-haneul-park',
    name_ko: '하늘공원',
    fields: {
      area_description:
        '하늘공원 관람·산책 지역 (Mapo, Seoul). 세부 출발·합류·종료 지점은 일정 편성 시 정해야 합니다.',
      duration_notes:
        '사용자가 제공한 계획용 체류시간 90–150분. 운영사 프로그램 시간이나 여행일 확정 일정과 구분합니다.',
      booking_notes:
        '공원 입장과 맹꽁이 전기차 이용은 별개입니다. 10명 동시 탑승은 확인되지 않았습니다.',
      group_simultaneous_use:
        '맹꽁이 전기차 10명 동시 탑승 미확인; 공원 입장과 별개',
    },
  },
  {
    id: 'nature-seokchon-lake',
    name_ko: '석촌호수',
    fields: {
      area_description:
        '석촌호수 관람·산책 지역 (Jamsil, Seoul). 세부 출발·합류·종료 지점은 일정 편성 시 정해야 합니다.',
      duration_notes:
        '사용자가 제공한 계획용 체류시간 45–90분. 운영사 프로그램 시간이나 여행일 확정 일정과 구분합니다.',
      booking_notes:
        '무료 산책 후보입니다. 벚꽃은 방문 계절에 따라 달라집니다.',
    },
  },
  {
    id: 'nature-seonyudo-park',
    name_ko: '선유도공원',
    fields: {
      area_description:
        '선유도공원 관람·산책 지역 (Yeongdeungpo, Seoul). 세부 출발·합류·종료 지점은 일정 편성 시 정해야 합니다.',
      duration_notes:
        '사용자가 제공한 계획용 체류시간 60–90분. 운영사 프로그램 시간이나 여행일 확정 일정과 구분합니다.',
      booking_notes:
        '일반 차량을 공원 내부 주차로 안내하면 안 됩니다. 주변 하차·주차 위치를 별도로 계획해야 합니다.',
    },
  },
  {
    id: 'nature-banpo-hangang',
    name_ko: '반포한강공원·달빛무지개분수',
    fields: {
      area_description:
        '반포한강공원·달빛무지개분수 관람·산책 지역 (Banpo, Seoul). 세부 출발·합류·종료 지점은 일정 편성 시 정해야 합니다.',
      duration_notes:
        '사용자가 제공한 계획용 체류시간 60–120분. 운영사 프로그램 시간이나 여행일 확정 일정과 구분합니다.',
      booking_notes:
        '전용 운영 안내는 3월 15일~10월입니다. 현재 기준인 11월에는 분수 관람을 확정 일정으로 표시하지 않습니다.',
    },
  },
  {
    id: 'nature-olympic-park',
    name_ko: '올림픽공원',
    fields: {
      area_description:
        '올림픽공원 관람·산책 지역 (Songpa, Seoul). 세부 출발·합류·종료 지점은 일정 편성 시 정해야 합니다.',
      duration_notes:
        '사용자가 제공한 계획용 체류시간 90–150분. 운영사 프로그램 시간이나 여행일 확정 일정과 구분합니다.',
      booking_notes: '일반 공원 이용과 공연·전시·스포츠시설 입장은 별개입니다.',
    },
  },
  {
    id: 'nature-hwadam',
    name_ko: '화담숲',
    fields: {
      area_description:
        '화담숲 관람·산책 지역 (Gwangju, Gyeonggi · conditional day trip). 세부 출발·합류·종료 지점은 일정 편성 시 정해야 합니다.',
      duration_notes:
        '사용자가 제공한 계획용 체류시간 120–180분. 운영사 프로그램 시간이나 여행일 확정 일정과 구분합니다.',
      booking_notes:
        '근교 조건부. 공식 FAQ는 단체예약을 받지 않는다고 안내합니다. 같은 시간대의 개별 입장권 10장과 차량 이동 조건을 확인해야 합니다.',
      group_simultaneous_use:
        '단체예약 불가; 같은 시간대 개별 입장권 10장과 이동 조건 확인',
    },
  },
  {
    id: 'nature-gwanggyo-lake',
    name_ko: '광교호수공원',
    fields: {
      area_description:
        '광교호수공원 관람·산책 지역 (Suwon, Gyeonggi · conditional day trip). 세부 출발·합류·종료 지점은 일정 편성 시 정해야 합니다.',
      duration_notes:
        '사용자가 제공한 계획용 체류시간 60–120분. 운영사 프로그램 시간이나 여행일 확정 일정과 구분합니다.',
      booking_notes:
        '근교 조건부. 선택 구간 산책으로 계획합니다. 주차 위치와 방문일 차량 경로는 별도 확인입니다.',
    },
  },
  {
    id: 'nature-dumulmeori',
    name_ko: '두물머리',
    fields: {
      area_description:
        '두물머리 관람·산책 지역 (Yangpyeong, Gyeonggi · conditional day trip). 세부 출발·합류·종료 지점은 일정 편성 시 정해야 합니다.',
      duration_notes:
        '사용자가 제공한 계획용 체류시간 60–90분. 운영사 프로그램 시간이나 여행일 확정 일정과 구분합니다.',
      booking_notes:
        '근교 조건부. 수변 산책과 주변 주차를 구분합니다. 숙소·시간대별 차량 2시간 조건을 확인해야 합니다.',
    },
  },
  {
    id: 'experience-lotte-world',
    name_ko: '롯데월드 어드벤처',
    fields: {
      duration_notes:
        '사용자가 제공한 계획용 체류시간 240–420분. 운영사 프로그램 시간이나 여행일 확정 일정과 구분합니다.',
      booking_notes:
        '개인 입장권 10장 기준입니다. 어드벤처만 이용하는 상품과 민속박물관 포함 상품을 구분해야 합니다.',
      group_discount: '개인 입장권 10장 기준; 민속박물관 포함 여부 상품별 구분',
    },
  },
  {
    id: 'experience-seoul-sky',
    name_ko: '서울스카이 전망대',
    fields: {
      duration_notes:
        '사용자가 제공한 계획용 체류시간 60–120분. 운영사 프로그램 시간이나 여행일 확정 일정과 구분합니다.',
      booking_notes:
        '같은 시간대의 티켓을 확인합니다. 스카이브릿지는 별도 상품입니다.',
      group_simultaneous_use: '같은 시간대 티켓 확인; 스카이브릿지는 별도 상품',
    },
  },
  {
    id: 'experience-n-seoul-tower',
    name_ko: 'N서울타워 전망대',
    fields: {
      duration_notes:
        '사용자가 제공한 계획용 체류시간 90–150분. 운영사 프로그램 시간이나 여행일 확정 일정과 구분합니다.',
      booking_notes:
        '전망대 입장과 정상 접근 교통은 별도입니다. 공식 영어 Walknic 상품은 8~15명 범위를 안내하지만, 날짜별 진행은 확인해야 합니다.',
      group_simultaneous_use:
        '별도 Walknic 상품 8~15명 범위이나 날짜별 진행 확인 필요',
      english_notes:
        '사용자 제공 자료: 별도 영어 Walknic 상품 8~15명 안내. 일반 전망대 입장과 구분하며 여행일 진행·영어 프로그램 배정은 미확인입니다.',
    },
  },
  {
    id: 'experience-eland-cruise',
    name_ko: '이랜드크루즈 여의도 한강유람선',
    fields: {
      duration_notes:
        '사용자가 제공한 계획용 체류시간 90–150분. 운영사 프로그램 시간이나 여행일 확정 일정과 구분합니다.',
      booking_notes:
        '같은 항차의 10석을 확보해야 합니다. 체크인·신분증과 선택 상품의 실제 항해시간을 확인합니다.',
      group_simultaneous_use:
        '같은 항차 10석 필요; 체크인·신분증·실제 항해시간 확인',
    },
  },
  {
    id: 'experience-paju-dmz',
    name_ko: '파주 DMZ 제3땅굴·도라전망대 투어',
    fields: {
      area_description:
        '파주 DMZ 제3땅굴·도라전망대 통제구역 투어. 서울 이동 포함 제안이며 일반 차량 제3땅굴 직접 진입 경로가 아닙니다.',
      duration_notes:
        '서울 왕복 이동을 포함한 360~480분 계획 제안입니다. 순수 투어 운영시간 또는 실제 차량 이동시간을 뜻하지 않습니다.',
      booking_notes:
        '근교 조건부. 서울 이동 포함 360~480분 제안입니다. 영어 포함 출발편의 10석, 인정 신분증 원본, 휴무·통제를 확인해야 합니다. 파주시 직접 투어에는 자체 가이드가 없습니다. 일반 차량이 제3땅굴까지 직접 진입하는 경로로 표시하면 안 됩니다.',
      group_simultaneous_use:
        '영어 포함 같은 출발편 10석·인정 신분증 원본·휴무 및 통제 확인',
      english_notes:
        '영어 포함 출발편 선택과 10석 확보가 필요합니다. 파주시 직접 투어에는 자체 가이드가 없습니다.',
    },
  },
  {
    id: 'experience-ongo-cooking',
    name_ko: '온고푸드 북촌 단체 한식 쿠킹클래스',
    fields: {
      duration_notes:
        '계획용 체류 180~210분. 사용자 제공 공식 단체 프로그램 시간은 약 3시간(180분)이며 날짜·가격은 견적/확인 이메일로 확정합니다.',
      booking_notes:
        '공식 단체 프로그램은 8~100명, 약 3시간, 영어 진행입니다. 10명이 인원 범위에 들어가며 날짜·가격은 견적과 확인 이메일로 확정합니다.',
      group_simultaneous_use:
        '공식 단체 프로그램 8~100명; 10명은 범위 내이나 날짜·가격은 견적/확인 이메일로 확정',
      english_notes:
        '사용자 제공 공식 프로그램 안내에 영어 진행 표기. 실제 여행일 프로그램·견적·확인 이메일은 미확정입니다.',
    },
  },
  {
    id: 'experience-running-man',
    name_ko: '런닝맨 체험관 인사동점',
    fields: {
      duration_notes:
        '계획용 체류 90~120분. 실제 상품은 60분·90분 등으로 나뉘므로 단일 운영사 시간으로 확정하지 않았습니다.',
      booking_notes:
        '실제 상품은 60분·90분 등으로 구분됩니다. 10명 동시 시작이나 독점 이용은 보장되지 않습니다.',
      group_simultaneous_use:
        '10명 동시 시작·독점 이용 보장 안 됨; 실제 상품 60분·90분 등 별도',
    },
  },
  {
    id: 'experience-kiwoom-baseball',
    name_ko: '고척스카이돔 키움 야구 관람',
    fields: {
      duration_notes:
        '사용자가 제공한 계획용 체류시간 180–240분. 운영사 프로그램 시간이나 여행일 확정 일정과 구분합니다.',
      booking_notes:
        '홈경기 날짜가 필요합니다. 온라인 1인 4매 한도이므로 10매는 4+4+2매, 최소 3명의 정상 구매주체가 필요합니다. 인접 10석은 별도 확인입니다.',
      group_simultaneous_use:
        '홈경기 날짜·인접 10석 확인. 온라인 1인 4매 한도, 4+4+2매로 최소 3명 정상 구매 필요',
    },
  },
  {
    id: 'experience-1million-dance',
    name_ko: '1MILLION K-pop 댄스클래스',
    fields: {
      duration_notes:
        '사용자가 제공한 계획용 체류시간 90–120분. 운영사 프로그램 시간이나 여행일 확정 일정과 구분합니다.',
      booking_notes:
        '같은 수업의 10석과 난이도를 확인해야 합니다. 영어 직원이 있다는 것과 수업 전체가 영어라는 것은 구분했습니다.',
      group_simultaneous_use: '같은 수업 10석·난이도 확인 필요',
      english_notes:
        '사용자 제공 자료: 영어 직원 안내. 수업 전체 영어 진행은 미확인으로 english_program은 unknown입니다.',
    },
  },
  {
    id: 'experience-branme-color',
    name_ko: 'BRANME 성수 퍼스널컬러 그룹 워크숍',
    fields: {
      duration_notes:
        '120~180분은 임시 계획용 편성안입니다. 공식 소요시간·10인 동시 진행·분반은 문의해야 합니다.',
      booking_notes:
        '120~180분은 임시 편성안입니다. 공식 Blue 상품은 5~10명입니다. 성수점 영어 상담은 안내되어 있으나, 10명 동시 진행·분반·정확한 소요시간은 문의해야 합니다.',
      group_simultaneous_use:
        'Blue 상품 5~10명; 10명 동시 진행·분반·정확한 소요시간 문의',
      english_notes:
        '사용자 제공 자료: 성수점 영어 상담 안내. 실제 10명 영어 상담 배정·분반은 문의 필요하며 전체 영어 프로그램은 미확인입니다.',
    },
  },
  {
    id: 'shopping-the-hyundai',
    name_ko: '더현대 서울',
    fields: {
      duration_notes:
        '사용자가 제공한 계획용 체류시간 120–180분. 운영사 프로그램 시간이나 여행일 확정 일정과 구분합니다.',
      booking_notes:
        '자유 쇼핑 후보입니다. 특정 팝업과 카페 이용은 별도 조건을 확인합니다.',
    },
  },
  {
    id: 'shopping-coex-library',
    name_ko: '스타필드 코엑스몰·별마당도서관',
    fields: {
      duration_notes:
        '사용자가 제공한 계획용 체류시간 120–180분. 운영사 프로그램 시간이나 여행일 확정 일정과 구분합니다.',
      booking_notes:
        '쇼핑·식사·전시를 선택해서 묶는 후보입니다. 별마당도서관 일반 이용과 유료 시설을 구분합니다.',
    },
  },
  {
    id: 'shopping-shinsegae-main',
    name_ko: '신세계백화점 본점',
    fields: {
      duration_notes:
        '사용자가 제공한 계획용 체류시간 90–150분. 운영사 프로그램 시간이나 여행일 확정 일정과 구분합니다.',
      booking_notes:
        '외국인 고객서비스 안내가 있습니다. 식당 좌석이나 특별행사는 별도입니다.',
    },
  },
  {
    id: 'shopping-gwangjang-market',
    name_ko: '광장시장',
    fields: {
      area_description:
        '광장시장 관람·산책 지역 (Jongno, Seoul). 세부 출발·합류·종료 지점은 일정 편성 시 정해야 합니다.',
      duration_notes:
        '사용자가 제공한 계획용 체류시간 60–90분. 운영사 프로그램 시간이나 여행일 확정 일정과 구분합니다.',
      booking_notes:
        '시장 탐방 카드입니다. 특정 노점이나 식당의 10인 예약 가능성을 확인한 것은 아닙니다.',
      group_simultaneous_use:
        '시장 탐방만 해당; 특정 노점·식당 10인 예약 미확인',
    },
  },
  {
    id: 'shopping-myeongdong',
    name_ko: '명동 쇼핑거리',
    fields: {
      area_description:
        '명동 쇼핑거리 관람·산책 지역 (Myeongdong, Seoul). 세부 출발·합류·종료 지점은 일정 편성 시 정해야 합니다.',
      duration_notes:
        '사용자가 제공한 계획용 체류시간 90–150분. 운영사 프로그램 시간이나 여행일 확정 일정과 구분합니다.',
      booking_notes:
        '단일 시설이 아니므로 합류 지점을 정하는 방식이 좋겠습니다. 개별 매장·식당 이용은 별도입니다.',
    },
  },
  {
    id: 'shopping-ssamzigil',
    name_ko: '쌈지길',
    fields: {
      duration_notes:
        '사용자가 제공한 계획용 체류시간 60–90분. 운영사 프로그램 시간이나 여행일 확정 일정과 구분합니다.',
      booking_notes:
        '상점 구경과 공방 체험을 구분합니다. 10인 체험은 해당 공방에 문의해야 합니다.',
      group_simultaneous_use: '쇼핑과 공방 체험 별개; 10인 체험 해당 공방 문의',
    },
  },
  {
    id: 'shopping-adererror-seongsu',
    name_ko: '아더에러 성수 스페이스',
    fields: {
      duration_notes:
        '사용자가 제공한 계획용 체류시간 45–75분. 운영사 프로그램 시간이나 여행일 확정 일정과 구분합니다.',
      booking_notes:
        '한국관광공사가 주말 대기 가능성을 안내합니다. 10명 동시 입장·피팅은 확인되지 않았습니다.',
      group_simultaneous_use: '주말 대기 가능; 10명 동시 입장·피팅 미확인',
    },
  },
  {
    id: 'shopping-olive-young-n',
    name_ko: '올리브영N 성수',
    fields: {
      duration_notes:
        '사용자가 제공한 계획용 체류시간 60–90분. 운영사 프로그램 시간이나 여행일 확정 일정과 구분합니다.',
      booking_notes:
        '다국어 직원·영문 상품 안내를 운영사가 소개합니다. 쇼핑과 개인 컨설팅 예약은 분리해야 합니다.',
      english_notes:
        '사용자 제공 운영사 자료: 다국어 직원·영문 상품 안내. 특정 영어 직원 배정이나 개인 컨설팅 예약은 미확인입니다.',
    },
  },
  {
    id: 'shopping-musinsa-daelim',
    name_ko: '무신사 스토어 성수@대림창고',
    fields: {
      duration_notes:
        '사용자가 제공한 계획용 체류시간 45–75분. 운영사 프로그램 시간이나 여행일 확정 일정과 구분합니다.',
      booking_notes:
        '무신사 STANDARD 등 다른 매장과 구분했습니다. 방문일 팝업은 별도로 확인해야 합니다.',
    },
  },
  {
    id: 'shopping-haus-nowhere-dosan',
    name_ko: '하우스 도산 — HAUS NOWHERE DOSAN',
    fields: {
      duration_notes:
        '사용자가 제공한 계획용 체류시간 45–75분. 운영사 프로그램 시간이나 여행일 확정 일정과 구분합니다.',
      booking_notes:
        '현재 공식 매장명이 HAUS NOWHERE DOSAN으로 표시됩니다. 피팅 서비스와 개별 브랜드 이용 조건은 별도입니다.',
    },
  },
  {
    id: 'wellness-cheongdam-oracle',
    name_ko: '청담오라클피부과',
    fields: {
      address: '강남구 선릉로 612',
      duration_notes:
        '사용자가 체류시간을 제공하지 않았습니다. 상담·진료 시간은 예약 기관에 확인해야 합니다.',
      booking_notes:
        '사용자 제공 조사 근거이며 의료진 자격·진료 적합성은 독립 검증하지 않았습니다. 10명 이용·동시 상담·진료, 일정·가격·실제 담당자와 통역 배정은 별도 문의입니다. 공식 의료진 소개에서 노영우 피부과 전문의 표기를 확인했다는 사용자 자료입니다. 모든 의료진에게 일괄 적용하는 의미는 아닙니다. 실제 담당 의사와 통역 배정 확인.',
      group_simultaneous_use:
        '10명 동시 상담·진료 또는 단체 수용 조건 미제공; 개별 문의 필요',
      english_notes:
        '사용자 제공 영어 상담·외국인 지원 경로입니다. 영어 웹사이트, 통역, 현장 영어 직원과 영어 프로그램은 별개이며 실제 담당자·통역 배정은 미확정입니다. 공식 영문 사이트의 WhatsApp·이메일 문의',
    },
  },
  {
    id: 'wellness-cnp-dogok',
    name_ko: '차앤박피부과 도곡양재',
    fields: {
      address: '강남구 강남대로 248',
      duration_notes:
        '사용자가 체류시간을 제공하지 않았습니다. 상담·진료 시간은 예약 기관에 확인해야 합니다.',
      booking_notes:
        '사용자 제공 조사 근거이며 의료진 자격·진료 적합성은 독립 검증하지 않았습니다. 10명 이용·동시 상담·진료, 일정·가격·실제 담당자와 통역 배정은 별도 문의입니다. 공식 지점 페이지에 의사별 Dermatologist 표기와 영어 지원이 있다는 사용자 자료입니다. 이를 별도의 자격 검증 없이 모든 의료진 board-certified로 확대하지 않았습니다.',
      group_simultaneous_use:
        '10명 동시 상담·진료 또는 단체 수용 조건 미제공; 개별 문의 필요',
      english_notes:
        '사용자 제공 영어 상담·외국인 지원 경로입니다. 영어 웹사이트, 통역, 현장 영어 직원과 영어 프로그램은 별개이며 실제 담당자·통역 배정은 미확정입니다. 공식 도곡양재 지점·상담 안내',
    },
  },
  {
    id: 'wellness-leaders-cheongdam',
    name_ko: '리더스피부과 청담명품거리점',
    fields: {
      address: '강남구 압구정로 445',
      duration_notes:
        '사용자가 체류시간을 제공하지 않았습니다. 상담·진료 시간은 예약 기관에 확인해야 합니다.',
      booking_notes:
        '사용자 제공 조사 근거이며 의료진 자격·진료 적합성은 독립 검증하지 않았습니다. 10명 이용·동시 상담·진료, 일정·가격·실제 담당자와 통역 배정은 별도 문의입니다. 공식 소개에서 정성태 의료진의 피부과 전문의 경력을 확인했다는 사용자 자료입니다. 청담도산대로 등 다른 지점과 구분했습니다. 공식 영문 사이트에서 청담명품거리점을 지정해야 합니다.',
      group_simultaneous_use:
        '10명 동시 상담·진료 또는 단체 수용 조건 미제공; 개별 문의 필요',
      english_notes:
        '사용자 제공 영어 상담·외국인 지원 경로입니다. 영어 웹사이트, 통역, 현장 영어 직원과 영어 프로그램은 별개이며 실제 담당자·통역 배정은 미확정입니다. 공식 영문 사이트에서 해당 지점 지정',
    },
  },
  {
    id: 'wellness-renewme-dongdaemun',
    name_ko: '리뉴미피부과 동대문점',
    fields: {
      address: '중구 을지로 251',
      duration_notes:
        '사용자가 체류시간을 제공하지 않았습니다. 상담·진료 시간은 예약 기관에 확인해야 합니다.',
      booking_notes:
        '사용자 제공 조사 근거이며 의료진 자격·진료 적합성은 독립 검증하지 않았습니다. 10명 이용·동시 상담·진료, 일정·가격·실제 담당자와 통역 배정은 별도 문의입니다. 운영사의 외국인 서비스 안내에 피부과 전문의 진료와 영어 통역 지원이 있다는 사용자 자료입니다. 실제 예약 담당자의 이름·자격은 확인 필요입니다.',
      group_simultaneous_use:
        '10명 동시 상담·진료 또는 단체 수용 조건 미제공; 개별 문의 필요',
      english_notes:
        '사용자 제공 영어 상담·외국인 지원 경로입니다. 영어 웹사이트, 통역, 현장 영어 직원과 영어 프로그램은 별개이며 실제 담당자·통역 배정은 미확정입니다. 공식 동대문점 외국인 안내·영어 통역 문의',
    },
  },
  {
    id: 'wellness-banobagi',
    name_ko: '바노바기피부과',
    fields: {
      address: '강남구 봉은사로 219',
      duration_notes:
        '사용자가 체류시간을 제공하지 않았습니다. 상담·진료 시간은 예약 기관에 확인해야 합니다.',
      booking_notes:
        '사용자 제공 조사 근거이며 의료진 자격·진료 적합성은 독립 검증하지 않았습니다. 10명 이용·동시 상담·진료, 일정·가격·실제 담당자와 통역 배정은 별도 문의입니다. 공식 의료진 페이지에서 반재용·전희대 피부과 전문의 소개를 확인했다는 사용자 자료입니다. 성형외과 지점·주소와 구분했습니다.',
      group_simultaneous_use:
        '10명 동시 상담·진료 또는 단체 수용 조건 미제공; 개별 문의 필요',
      english_notes:
        '사용자 제공 영어 상담·외국인 지원 경로입니다. 영어 웹사이트, 통역, 현장 영어 직원과 영어 프로그램은 별개이며 실제 담당자·통역 배정은 미확정입니다. 피부과 공식 영문 예약',
    },
  },
  {
    id: 'wellness-arumdaun-nara',
    name_ko: '강남 아름다운나라피부과',
    fields: {
      address: '강남구 강남대로 390',
      duration_notes:
        '사용자가 체류시간을 제공하지 않았습니다. 상담·진료 시간은 예약 기관에 확인해야 합니다.',
      booking_notes:
        '사용자 제공 조사 근거이며 의료진 자격·진료 적합성은 독립 검증하지 않았습니다. 10명 이용·동시 상담·진료, 일정·가격·실제 담당자와 통역 배정은 별도 문의입니다. 서울시 의료관광 페이지의 피부과 분류와 다국어 지원을 확인했다는 사용자 자료입니다. 개별 예약 담당자의 전문의 자격은 이번 조사에서 확인하지 못했습니다.',
      group_simultaneous_use:
        '10명 동시 상담·진료 또는 단체 수용 조건 미제공; 개별 문의 필요',
      english_notes:
        '사용자 제공 영어 상담·외국인 지원 경로입니다. 영어 웹사이트, 통역, 현장 영어 직원과 영어 프로그램은 별개이며 실제 담당자·통역 배정은 미확정입니다. 서울시 공식 의료관광 안내의 국제상담 연락처. 다국어 지원 안내이며 영어 담당자 배정은 별도 확인',
    },
  },
  {
    id: 'wellness-wells-apgujeong',
    name_ko: '웰스피부과 압구정',
    fields: {
      address: '강남구 논현로 842',
      duration_notes:
        '사용자가 체류시간을 제공하지 않았습니다. 상담·진료 시간은 예약 기관에 확인해야 합니다.',
      booking_notes:
        '사용자 제공 조사 근거이며 의료진 자격·진료 적합성은 독립 검증하지 않았습니다. 10명 이용·동시 상담·진료, 일정·가격·실제 담당자와 통역 배정은 별도 문의입니다. 공식 의료진 소개에 한국 피부과 전문의 자격이 명시되어 있다는 사용자 자료입니다. 예약 당일 담당자는 별도 확인해야 합니다.',
      group_simultaneous_use:
        '10명 동시 상담·진료 또는 단체 수용 조건 미제공; 개별 문의 필요',
      english_notes:
        '사용자 제공 영어 상담·외국인 지원 경로입니다. 영어 웹사이트, 통역, 현장 영어 직원과 영어 프로그램은 별개이며 실제 담당자·통역 배정은 미확정입니다. 공식 영문 상담 안내',
    },
  },
  {
    id: 'wellness-id-gangnam',
    name_ko: '아이디의원 강남점',
    fields: {
      address: '서초구 강남대로 437',
      duration_notes:
        '사용자가 체류시간을 제공하지 않았습니다. 상담·진료 시간은 예약 기관에 확인해야 합니다.',
      booking_notes:
        '사용자 제공 조사 근거이며 의료진 자격·진료 적합성은 독립 검증하지 않았습니다. 10명 이용·동시 상담·진료, 일정·가격·실제 담당자와 통역 배정은 별도 문의입니다. 영문 예약과 외국인 지원 경로가 있습니다. 담당자의 피부과 전문의 자격은 확인하지 못했습니다. Gangnam 지점 선택이 필요합니다.',
      group_simultaneous_use:
        '10명 동시 상담·진료 또는 단체 수용 조건 미제공; 개별 문의 필요',
      english_notes:
        '사용자 제공 영어 상담·외국인 지원 경로입니다. 영어 웹사이트, 통역, 현장 영어 직원과 영어 프로그램은 별개이며 실제 담당자·통역 배정은 미확정입니다. 공식 영문 예약에서 Gangnam 선택',
    },
  },
  {
    id: 'wellness-jfeel-hongdae',
    name_ko: '제이필의원 홍대점',
    fields: {
      address: '마포구 양화로 166',
      duration_notes:
        '사용자가 체류시간을 제공하지 않았습니다. 상담·진료 시간은 예약 기관에 확인해야 합니다.',
      booking_notes:
        '사용자 제공 조사 근거이며 의료진 자격·진료 적합성은 독립 검증하지 않았습니다. 10명 이용·동시 상담·진료, 일정·가격·실제 담당자와 통역 배정은 별도 문의입니다. 공식 외국인 안내와 영어 지원 자료를 확인했다는 사용자 자료입니다. 개별 담당자의 피부과 전문의 자격은 미확인입니다.',
      group_simultaneous_use:
        '10명 동시 상담·진료 또는 단체 수용 조건 미제공; 개별 문의 필요',
      english_notes:
        '사용자 제공 영어 상담·외국인 지원 경로입니다. 영어 웹사이트, 통역, 현장 영어 직원과 영어 프로그램은 별개이며 실제 담당자·통역 배정은 미확정입니다. 공식 사이트의 외국인 상담 창구; 영어 지원 자료는 있으나 실제 영어 담당자 배정 확인 필요',
    },
  },
  {
    id: 'wellness-lienjang-gangnam',
    name_ko: '리엔장 강남',
    fields: {
      address: '서초구 강남대로 403',
      duration_notes:
        '사용자가 체류시간을 제공하지 않았습니다. 상담·진료 시간은 예약 기관에 확인해야 합니다.',
      booking_notes:
        '사용자 제공 조사 근거이며 의료진 자격·진료 적합성은 독립 검증하지 않았습니다. 10명 이용·동시 상담·진료, 일정·가격·실제 담당자와 통역 배정은 별도 문의입니다. 공식 영문 명칭은 Plastic Surgery & Aesthetic Clinic입니다. 모든 진료자가 피부과 전문의라는 의미로 표시하지 않았습니다.',
      group_simultaneous_use:
        '10명 동시 상담·진료 또는 단체 수용 조건 미제공; 개별 문의 필요',
      english_notes:
        '사용자 제공 영어 상담·외국인 지원 경로입니다. 영어 웹사이트, 통역, 현장 영어 직원과 영어 프로그램은 별개이며 실제 담당자·통역 배정은 미확정입니다. 강남 공식 영문 사이트의 외국인 예약 창구',
    },
  },
];

export function buildContentTranslationSql(inputs) {
  assert.equal(inputs.length, 70, 'Expected the supplied 70 activities.');
  const records = inputs.map(parseActivity);
  const byId = new Map(records.map((record) => [record.id, record]));
  assert.equal(byId.size, 70, 'Activity IDs must be unique.');
  for (const record of records)
    for (const [key, value] of Object.entries(record))
      if (key !== 'name_ko')
        assert.ok(
          !hangul.test(JSON.stringify(value)),
          `Public content must be English: ${record.id}.${key}`,
        );
  const statements = ORIGINAL_CONTENT.map((original) => {
    const record = byId.get(original.id);
    assert.ok(
      record && record.name_ko === original.name_ko,
      `Activity identity mismatch: ${original.id}`,
    );
    const fields = {
      ...original.fields,
      group_reservation: original.fields.booking_notes,
    };
    const assignments = Object.entries(fields).map(([field, before]) => {
      assert.equal(
        typeof record[field],
        'string',
        `Missing translation: ${original.id}.${field}`,
      );
      return `${field} = CASE WHEN ${field} = ${quote(before)} THEN ${quote(record[field])} ELSE ${field} END`;
    });
    const beforeEvidence =
      originalPrefix + original.fields.booking_notes + originalSuffix;
    const knownEvidence = `(source_evidence = ${quote(beforeEvidence)} OR substr(source_evidence, 1, ${beforeEvidence.length + 1}) = ${quote(beforeEvidence)} || char(10))`;
    assignments.push(
      `source_evidence = CASE WHEN ${knownEvidence} THEN ${quote(record.source_evidence)} || substr(source_evidence, ${beforeEvidence.length + 1}) ELSE source_evidence END`,
    );
    const changes = [
      ...Object.entries(fields).map(
        ([field, before]) => `${field} = ${quote(before)}`,
      ),
      knownEvidence,
    ].join(' OR ');
    return `UPDATE activities SET ${assignments.join(', ')}, updated_at = strftime('%Y-%m-%dT%H:%M:%fZ', 'now') WHERE id = ${quote(original.id)} AND name_ko = ${quote(original.name_ko)} AND (${changes});`;
  });
  const ids = records.map((record) => quote(record.id)).join(', ');
  const photoStart = "instr(source_evidence, char(10) || 'Photo (')";
  for (const [before, after] of Object.entries(PHOTO_CREDIT_TRANSLATIONS))
    statements.push(
      `UPDATE activities SET source_evidence = substr(source_evidence, 1, ${photoStart} - 1) || replace(substr(source_evidence, ${photoStart}), ${quote(before)}, ${quote(after)}), updated_at = strftime('%Y-%m-%dT%H:%M:%fZ', 'now') WHERE id IN (${ids}) AND ${photoStart} > 0 AND instr(substr(source_evidence, ${photoStart}), ${quote(before)}) > 0;`,
    );
  return statements.join('\n');
}

if (
  process.argv[1] &&
  import.meta.url === pathToFileURL(resolve(process.argv[1])).href
) {
  assert.equal(
    process.argv.length,
    3,
    'Usage: node --experimental-strip-types scripts/translate-activity-content.mjs --check|--sql',
  );
  assert.ok(
    ['--check', '--sql'].includes(process.argv[2]),
    'Use --check or --sql; this script never writes a database directly.',
  );
  const records = JSON.parse(
    await readFile(
      new URL('../data/activities-70.json', import.meta.url),
      'utf8',
    ),
  );
  const sql = buildContentTranslationSql(records);
  if (process.argv[2] === '--sql') process.stdout.write(sql + '\n');
  else
    console.log(
      '70 English activity records validated; exact-match translation SQL is ready. No database was changed.',
    );
}
