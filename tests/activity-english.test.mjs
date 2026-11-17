import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { DatabaseSync } from 'node:sqlite';
import { parseActivity } from '../lib/activities.ts';
const activities = JSON.parse(
  await readFile(
    new URL('../data/activities-70.json', import.meta.url),
    'utf8',
  ),
);

await test('all public activity content is English while the original Korean identity is retained', () => {
  assert.equal(activities.length, 70);
  for (const input of activities) {
    const record = parseActivity(input);
    assert.match(record.name_ko, /[\uac00-\ud7a3]/);
    for (const [key, value] of Object.entries(record)) {
      if (key === 'name_ko') continue;
      assert.doesNotMatch(
        JSON.stringify(value),
        /[\uac00-\ud7a3\u3131-\u318e\u1100-\u11ff]/,
        `${record.id}.${key}`,
      );
    }
  }
});

const { buildContentTranslationSql, ORIGINAL_CONTENT } =
  await import('../scripts/translate-activity-content.mjs');
const { ACTIVITY_COLUMNS, BOOLEAN_FIELDS, URL_LIST_FIELDS } =
  await import('../lib/activities.ts');

await test('translation SQL preserves photos, evidence appendices and manual English edits across reruns', async () => {
  const db = new DatabaseSync(':memory:');
  db.exec(
    await readFile(
      new URL('../db/migrations/0001_activities.sql', import.meta.url),
      'utf8',
    ),
  );
  db.exec(
    await readFile(
      new URL(
        '../db/migrations/0002_history_and_photo_credits.sql',
        import.meta.url,
      ),
      'utf8',
    ),
  );
  for (const migration of [
    '0003_official_photo_references.sql',
    '0004_host_reviews_and_card_location.sql',
  ])
    db.exec(
      await readFile(
        new URL('../db/migrations/' + migration, import.meta.url),
        'utf8',
      ),
    );
  const prefix =
    '사용자가 제공한 조사 자료에서 가져왔습니다. 연결 페이지·영업 현황·예약 조건은 이번 가져오기에서 독립적으로 확인하지 않았습니다. 날짜별 예약, 실제 좌표, 차량 경로, Google 평점·리뷰 수·Place ID, 이미지 재사용 권한은 미확인입니다. ';
  const suffix =
    ' Google Maps와 YouTube 검색 링크는 장소명으로 생성한 탐색 링크이며 실제 Place ID·평점·관련 영상 검증이 아닙니다.';
  const authors = [
    '문화재청',
    '오모군',
    '서울연구원',
    '슐라',
    '책읽는달팽',
    '서울연구데이터서비스',
    '서울특별시 소방재난본부(Seoul Metropolitan Fire & Disaster Headquarters)',
  ];
  const expectedAuthors = [
    'Cultural Heritage Administration',
    'Omogun',
    'Seoul Institute',
    'Syulla',
    'Chaekikneundalpaeng',
    'Seoul Research Data Service',
    'Seoul Metropolitan Fire & Disaster Headquarters',
  ];
  for (const [index, original] of ORIGINAL_CONTENT.entries()) {
    const english = activities.find((record) => record.id === original.id);
    const record = parseActivity({
      ...english,
      ...original.fields,
      group_reservation: original.fields.booking_notes,
      source_evidence:
        prefix +
        original.fields.booking_notes +
        suffix +
        `\nPhoto (venue): Original photo | ${authors[index % authors.length]} / CC BY | https://example.com/photo | License: https://example.com/license`,
      image_url: '/trip/photos/keep-this.webp',
      image_rights: 'licensed',
      image_caption: 'Keep this exact caption',
      image_attribution: 'Keep this exact credit',
    });
    const values = ACTIVITY_COLUMNS.map((key) =>
      URL_LIST_FIELDS.includes(key)
        ? JSON.stringify(record[key])
        : BOOLEAN_FIELDS.includes(key)
          ? Number(record[key])
          : record[key],
    );
    db.prepare(
      `INSERT INTO activities (${ACTIVITY_COLUMNS.join(',')}) VALUES (${ACTIVITY_COLUMNS.map(() => '?').join(',')})`,
    ).run(...values);
  }
  db.exec(
    "UPDATE activities SET booking_notes='My English revision',source_evidence='My English evidence\nPhoto (venue): My caption | Omogun / CC BY',public_contact='Call my coordinator' WHERE id='food-jin-jin'",
  );
  db.exec(
    "INSERT INTO activities(id,name_ko,name_en,booking_notes) VALUES('manual-record','원본','Manual record','원래 한국어 메모')",
  );
  const sql = buildContentTranslationSql(activities);
  db.exec(sql);
  const records = db
    .prepare("SELECT * FROM activities WHERE id!='manual-record' ORDER BY id")
    .all();
  assert.equal(records.length, 70);
  for (const record of records) {
    for (const [key, value] of Object.entries(record))
      if (key !== 'name_ko')
        assert.doesNotMatch(
          JSON.stringify(value),
          /[\uac00-\ud7a3\u3131-\u318e\u1100-\u11ff]/,
          record.id + '.' + key,
        );
    assert.equal(record.image_url, '/trip/photos/keep-this.webp');
    assert.equal(record.image_caption, 'Keep this exact caption');
    assert.equal(record.image_attribution, 'Keep this exact credit');
    assert.equal(record.image_rights, 'licensed');
    assert.match(record.source_evidence, /\nPhoto \(venue\):/);
    if (record.id !== 'food-jin-jin') {
      const index = ORIGINAL_CONTENT.findIndex(
        (original) => original.id === record.id,
      );
      assert.ok(
        record.source_evidence.endsWith(
          `\nPhoto (venue): Original photo | ${expectedAuthors[index % expectedAuthors.length]} / CC BY | https://example.com/photo | License: https://example.com/license`,
        ),
      );
      assert.ok(
        record.source_evidence.startsWith(
          'Imported from user-supplied research.',
        ),
      );
    }
  }
  const manualEdit = records.find((record) => record.id === 'food-jin-jin');
  assert.equal(manualEdit.booking_notes, 'My English revision');
  assert.equal(manualEdit.public_contact, 'Call my coordinator');
  assert.equal(
    manualEdit.source_evidence,
    'My English evidence\nPhoto (venue): My caption | Omogun / CC BY',
  );
  assert.equal(
    db
      .prepare("SELECT booking_notes FROM activities WHERE id='manual-record'")
      .get().booking_notes,
    '원래 한국어 메모',
  );
  assert.equal(
    db
      .prepare(
        "SELECT operator_duration_minutes FROM activities WHERE id='culture-gugak-saturday'",
      )
      .get().operator_duration_minutes,
    80,
  );
  assert.equal(
    db
      .prepare(
        "SELECT operator_duration_minutes FROM activities WHERE id='experience-ongo-cooking'",
      )
      .get().operator_duration_minutes,
    180,
  );
  db.exec(sql);
  assert.deepEqual(
    db
      .prepare("SELECT * FROM activities WHERE id!='manual-record' ORDER BY id")
      .all(),
    records,
  );
  db.close();
});
