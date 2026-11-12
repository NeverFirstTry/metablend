import { test } from 'node:test'
import assert from 'node:assert/strict'
import { toHans, placeIn } from './zh-hans.js'
import PAIRS from './zh-hans-table.js'

// Chinese here is simplified Chinese: place names that arrive in traditional script are shown in simplified
test('toHans — traditional characters become simplified, everything else stays', () => {
  assert.equal(toHans('維也納'), '维也纳')
  assert.equal(toHans('奧地利'), '奥地利')
  assert.equal(toHans('維也納州'), '维也纳州')
  assert.equal(toHans('臺北'), '台北')
  assert.equal(toHans('蘇黎世, 瑞士'), '苏黎世, 瑞士')
  assert.equal(toHans('格羅斯格洛克納山'), '格罗斯格洛克纳山')
  for (const same of ['维也纳', '东京', '香港', 'Wien', 'Großglockner', 'ウィーン', '빈', '', null, undefined]) assert.equal(toHans(same), same)
})

test('placeIn — only Chinese readers get the conversion', () => {
  assert.equal(placeIn('zh', '維也納'), '维也纳')
  for (const lang of ['en', 'de', 'ja', 'ko']) assert.equal(placeIn(lang, '維也納'), '維也納')
})

test('zh-hans-table — whole characters in pairs, each one different from its simplified form', () => {
  const c = [...PAIRS]
  assert.equal(c.length % 2, 0)
  assert.ok(c.length / 2 > 4000, `${c.length / 2} pairs`)
  for (let i = 0; i < c.length; i += 2) assert.notEqual(c[i], c[i + 1], `pair ${i / 2}`)
})
