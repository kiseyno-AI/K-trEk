import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';

const manifest = JSON.parse(await readFile(new URL('../data/activity-photos.json', import.meta.url), 'utf8'));
const dataset = JSON.parse(await readFile(new URL('../data/activities-70.json', import.meta.url), 'utf8'));
const activities = Array.isArray(dataset) ? dataset : dataset.activities;
const photoByKey = new Map(manifest.photos.map((photo) => [photo.key, photo]));
const oldStandIns = new Map([
  ['food-korea-house', 'korea-house'],
  ['food-samwon-garden', 'apgujeong'], ['food-hanilkwan-apgujeong', 'apgujeong'],
  ['food-byeokje-galbi-bangi', 'lotte-world-lake'], ['food-balwoo-gongyang', 'jogyesa'],
  ['food-jin-jin', 'hongdae'], ['food-born-and-bred', 'majang'], ['food-bicena', 'lotte-tower'],
  ['food-hwa-hae-dang', 'yeouido'], ['culture-hikr-ground', 'cheonggyecheon'],
  ['culture-nanta-myeongdong', 'myeongdong'], ['culture-hanboknam', 'gyeongbokgung'],
  ['culture-bukchon-crafts', 'bukchon'], ['experience-eland-cruise', 'yeouido'],
  ['experience-ongo-cooking', 'bukchon'], ['experience-running-man', 'insadong'],
  ['experience-1million-dance', 'seongsu'], ['experience-branme-color', 'seongsu'],
  ['shopping-adererror-seongsu', 'seongsu'], ['shopping-olive-young-n', 'seongsu'],
  ['shopping-musinsa-daelim', 'seongsu'], ['shopping-haus-nowhere-dosan', 'apgujeong'],
]);

await test('all 70 cards show their named subject instead of an area-context stand-in', () => {
  assert.equal(manifest.activities.length, 70);
  assert.equal(new Set(manifest.activities.map((record) => record.id)).size, 70);
  for (const record of manifest.activities) {
    assert.equal(record.role, 'venue', record.id);
    assert.doesNotMatch(record.caption, /Area context/i, record.id);
    const activity = activities.find((activity) => activity.id === record.id);
    assert.equal(record.name_ko, activity?.name_ko, record.id);
    assert.notEqual(record.photo_key, oldStandIns.get(record.id), record.id);
  }
});

await test('every assigned photo retains a source-backed visual subject review', () => {
  for (const record of manifest.activities) {
    const photo = photoByKey.get(record.photo_key);
    assert.ok(photo, record.id);
    assert.equal(record.image_url, photo.image_url, record.id);
    assert.ok(photo.subjectEvidence?.activity_ids.includes(record.id), record.id);
    assert.equal(photo.subjectEvidence?.visually_confirmed, true, record.id);
    assert.ok(photo.subjectEvidence?.description.length > 20, record.id);
    assert.ok(photo.subjectEvidence?.sourcePage, record.id);
    assert.match(photo.sourcePage, /^https:\/\//, record.id);
    assert.doesNotMatch(record.caption, /[가-힣]/, record.id);
    if (record.image_rights === 'official_reference') {
      assert.match(record.attribution, /reuse license unverified/i, record.id);
      assert.match(photo.license, /reuse license unverified/i, record.id);
    }
  }
});
