import { test } from 'node:test'
import assert from 'node:assert/strict'
import fs from 'node:fs'
import { routesNear, stitch, SAC, routeLabel, sacGrade } from './osm.js'
import { haversineM } from './geometry.js'

const fx = name => JSON.parse(fs.readFileSync(new URL(`./__fixtures__/${name}`, import.meta.url), 'utf8'))
const SUMMIT = { lat: 47.0745, lon: 12.6941 }

test('routesNear — the hiking relations that reach the Großglockner summit', () => {
  const found = routesNear(fx('osm-glockner-map.json'), SUMMIT)
  assert.ok(found.some(r => r.id === 14622955 && r.ref === '712'), JSON.stringify(found))
  assert.deepEqual(routesNear(fx('osm-glockner-map.json'), SUMMIT, 0), [])
  assert.deepEqual(routesNear(null, SUMMIT), [])
})

test('stitch — the 712 as one continuous line, with its tags', () => {
  const r = stitch(fx('osm-712-full.json'))
  assert.equal(r.id, 14622955)
  assert.equal(r.ref, '712')
  assert.equal(r.name, 'Alter Kalser Weg 712')
  assert.ok(r.points.length >= 70)
  for (let i = 1; i < r.points.length; i++) assert.ok(haversineM(r.points[i - 1], r.points[i]) < 800, `gap at ${i}`)
  assert.ok(r.difficulty === null || SAC.includes(r.difficulty))
  assert.equal(stitch({ elements: [] }), null)
})

test('routeLabel — number and name without repeating the number; nothing when OSM has neither', () => {
  assert.equal(routeLabel({ ref: '712', name: 'Alter Kalser Weg 712' }), 'Alter Kalser Weg 712')
  assert.equal(routeLabel({ ref: '712A', name: 'AV Weg 712A (Mürztaler Steig)' }), 'AV Weg 712A (Mürztaler Steig)')
  assert.equal(routeLabel({ ref: '14', name: 'Stüdlweg' }), '14 Stüdlweg')
  assert.equal(routeLabel({ ref: '14', name: null }), '14')
  assert.equal(routeLabel({ ref: null, name: null }), null)
})

test('sacGrade — OSM sac_scale as T1–T6, nothing for unknown values', () => {
  assert.equal(sacGrade('hiking'), 'T1')
  assert.equal(sacGrade('alpine_hiking'), 'T4')
  assert.equal(sacGrade('difficult_alpine_hiking'), 'T6')
  assert.equal(sacGrade(null), null)
  assert.equal(sacGrade('T3'), null)
})
