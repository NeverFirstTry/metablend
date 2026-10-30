import { test } from 'node:test'
import assert from 'node:assert/strict'
import { ownSearch, ownAnswers } from './search.js'

const peak = (id, name, lat, lon, elev, extra = {}) => ({ id, name, names: null, lat, lon, elev, kind: 'peak', country: 'CH', region: 'Valais', ...extra })
const ZERMATT = { id: 2657928, name: 'Zermatt', country: 'CH', region: 'Valais', population: 5800, lat: 46.0207, lon: 7.7491, exact: true, prefix: true }
const near = [peak('osm-N6', 'Gornergrat', 45.9836, 7.7845, 3135, { notability: 2 }), peak('osm-N8', 'Monte Rosa', 45.9369, 7.867, 4634, { notability: 3 })]
const hut = { ...peak('osm-W7', 'Hörnlihütte', 45.9817, 7.672, 3260), kind: 'hut' }

function fakePlaces({ search = [], towns = [], pool = near, huts = [hut] } = {}) {
  const calls = []
  const log = (name, value) => async (...args) => { calls.push(name); return typeof value === 'function' ? value(...args) : value }
  return { calls, search: log('search', search), towns: log('towns', towns), pool: log('pool', pool), near: log('near', huts) }
}
const deps = (places, extra = {}) => ({ places, featured: [], demEle: async points => points.map(() => 1000), geocode: async () => { throw new Error('the geocoder was asked') }, ...extra })

test('ownSearch — typing a name: summits and huts by name, no town, nothing outside; cached a day', async () => {
  const places = fakePlaces({ search: [peak('osm-N2', 'Matterhorn', 45.9763, 7.6586, 4478)] })
  const own = await ownSearch({ q: 'matterh', bias: null, full: false }, [], deps(places))
  assert.deepEqual(own.body.peaks.map(p => p.id), ['osm-N2'])
  assert.equal(own.body.around, null)
  assert.equal(own.age, 86400)
})

test('ownSearch — a town the query names: what\'s around it (summits spread over the area, its huts), nearest first; the typo guesses dropped', async () => {
  const places = fakePlaces({ search: [peak('osm-N99', 'Zermattspitz', 46.1, 7.7, 2500), peak('osm-N98', 'Zernezer Horn', 46.6, 10.1, 2700)], towns: [ZERMATT] })
  const own = await ownSearch({ q: 'zermatt', bias: null, full: false }, [], deps(places))
  assert.deepEqual(own.body.peaks.map(p => p.name), ['Zermattspitz'])
  assert.equal(own.body.around.place.name, 'Zermatt')
  assert.deepEqual(own.body.around.peaks.map(p => p.name), ['Gornergrat', 'Hörnlihütte', 'Monte Rosa'])
  assert.equal(own.age, 86400)
})

test('ownSearch — the towns lookup failing: no "around", and the answer cached 5 minutes, not a day', async () => {
  const own = await ownSearch({ q: 'zermatt', bias: null, full: false }, [], deps(fakePlaces({ towns: null })))
  assert.equal(own.body.around, null)
  assert.equal(own.age, 300)
})

test('ownSearch — a sent search for a village too small for our towns (Grindelwald): the geocoder says where it is, around it from our summits', async () => {
  const places = fakePlaces({ search: [peak('osm-N50', 'Grindelwaldblick', 46.6, 8.0, 1900), peak('osm-N51', 'Grindelhorn', 46.0, 8.0, 2100)] })
  const grindelwald = { name: 'Grindelwald', region: 'Bern', country: 'CH', lat: 46.6242, lon: 8.0414 }
  let asked = null
  const own = await ownSearch({ q: 'grindelwald', bias: null, full: true }, [], deps(places, { geocode: async q => { asked = q; return { place: grindelwald, down: false } } }))
  assert.equal(asked, 'grindelwald')
  assert.equal(own.body.around.place.name, 'Grindelwald')
  assert.deepEqual(own.body.peaks.map(p => p.name), ['Grindelwaldblick'])
  assert.equal(own.age, 86400)
  // while typing, never: the geocoder is for sent searches
  await ownSearch({ q: 'grindelwald', bias: null, full: false }, [], deps(places))
  // the geocoder down: cached 5 minutes
  const down = await ownSearch({ q: 'grindelwald', bias: null, full: true }, [], deps(places, { geocode: async () => ({ place: null, down: true }) }))
  assert.equal(down.age, 300)
})

test('ownSearch — a summit found by name and also around the town keeps its distance from you, not from the town', async () => {
  const mine = peak('osm-N6', 'Gornergrat', 45.9836, 7.7845, 3135, { notability: 2, km: 1.5 })
  const places = fakePlaces({ search: [mine], towns: [{ ...ZERMATT, name: 'Gornergrat Town' }], pool: [{ ...mine, km: 4.4 }] })
  const own = await ownSearch({ q: 'gornergrat', bias: { lat: 45.98, lon: 7.79 }, full: false }, [], deps(places))
  assert.equal(own.body.peaks[0].km, 1.5)
})

test('ownSearch — the database failing: null (the route falls back to the outside services)', async () => {
  assert.equal(await ownSearch({ q: 'zermatt', bias: null, full: false }, [], deps(fakePlaces({ search: null }))), null)
})

test('ownAnswers — our answer stands while typing, even empty; a sent search we have nothing for goes outside', () => {
  const empty = { body: { peaks: [], around: null }, age: 86400 }
  const some = { body: { peaks: [{ id: 'osm-N1' }], around: null }, age: 86400 }
  const aroundOnly = { body: { peaks: [], around: { place: {}, peaks: [{ id: 'osm-N2' }] } }, age: 86400 }
  assert.equal(ownAnswers(empty, false), true)
  assert.equal(ownAnswers(empty, true), false)
  assert.equal(ownAnswers(some, true), true)
  assert.equal(ownAnswers(aroundOnly, true), true)
  assert.equal(ownAnswers(null, false), false)
})
