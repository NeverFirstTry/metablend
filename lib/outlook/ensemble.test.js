import { test } from 'node:test'
import assert from 'node:assert/strict'
import { parseEnsemble, ensembleDay, applyEnsemble } from './ensemble.js'

function ens(nMembers) {
  const daily = { time: ['2026-10-07', '2026-10-08'] }
  for (let m = 0; m < nMembers; m++) {
    const sfx = m === 0 ? 'ecmwf_ifs025_ensemble' : `member${String(m).padStart(2, '0')}_ecmwf_ifs025_ensemble`
    daily[`temperature_2m_max_${sfx}`] = [10 + m, 20]
    daily[`temperature_2m_min_${sfx}`] = [m, 5]
    daily[`precipitation_sum_${sfx}`] = [m < 5 ? 3 : 0, 0]
  }
  return { daily }
}

test('parseEnsemble — collects the control run and every member per date', () => {
  const e = parseEnsemble(ens(20))
  assert.deepEqual(e.dates, ['2026-10-07', '2026-10-08'])
  assert.equal(e.max[0].length, 20)
  assert.equal(e.min[1].length, 20)
  assert.equal(parseEnsemble(null), null)
})

test('ensembleDay — p10–p90 bands and the share of wet members', () => {
  const d = ensembleDay(parseEnsemble(ens(20)), '2026-10-07')
  assert.deepEqual(d, { maxLo: 11.9, maxHi: 27.1, minLo: 1.9, minHi: 17.1, wetShare: 25, members: 20 })
  assert.equal(ensembleDay(parseEnsemble(ens(20)), '2026-12-24'), null)
  assert.equal(ensembleDay(parseEnsemble(ens(6)), '2026-10-07'), null) // too few members to mean anything
})

test('applyEnsemble — only week 2 changes, central values stay deterministic', () => {
  const days = [
    { date: '2026-10-06', lead: 7, tempMax: 15, maxLo: 14, maxHi: 16, minLo: 4, minHi: 6, rainPct: 40 },
    { date: '2026-10-07', lead: 8, tempMax: 15, maxLo: 14, maxHi: 16, minLo: 4, minHi: 6, rainPct: 40 },
  ]
  const out = applyEnsemble(days, parseEnsemble(ens(20)))
  assert.deepEqual(out[0], days[0])
  assert.equal(out[1].tempMax, 15)
  assert.deepEqual([out[1].maxLo, out[1].maxHi, out[1].rainPct, out[1].members], [11.9, 27.1, 25, 20])
})
