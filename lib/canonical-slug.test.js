// A city page has one address (owner, 2026-11-26: "City links with trailing or repeated hyphens, like
// /weather/wien---, render as their own page with spaces in the city name. They should redirect permanently to
// the canonical slug (/weather/wien). Check summit and airport pages for the same."). Until now every spelling was
// its own page: the hyphens became spaces for the geocoder, which found Vienna, and the page named itself "Wien   "
// with itself as its canonical address. Summit and airport pages take only an exact id or code, so they answer
// "not found" there; the last test holds that.
import './test-jsx-hooks.js'
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { seen, reset } from './test-route-fakes.js'
import { canonicalCitySlug } from './cities.js'

test('canonicalCitySlug: lower case, single hyphens, none at either end', () => {
  assert.equal(canonicalCitySlug('wien'), 'wien')
  assert.equal(canonicalCitySlug('wien---'), 'wien')
  assert.equal(canonicalCitySlug('---wien'), 'wien')
  assert.equal(canonicalCitySlug('new--york'), 'new-york')
  assert.equal(canonicalCitySlug('New-York'), 'new-york')
  assert.equal(canonicalCitySlug('new%20york'), 'new-york', 'a space is a hyphen')
  assert.equal(canonicalCitySlug('new york'), 'new-york')
  assert.equal(canonicalCitySlug('m%C3%BCnchen'), 'münchen', 'read from its percent form')
  assert.equal(canonicalCitySlug('münchen'), 'münchen')
  assert.equal(canonicalCitySlug('M%C3%9CNCHEN'), 'münchen')
  assert.equal(canonicalCitySlug('st.-johann'), 'st.-johann', 'other signs stay')
  assert.equal(canonicalCitySlug('---'), null, 'nothing left')
  assert.equal(canonicalCitySlug('%E0%A4%A'), null, 'an address that cannot be read')
  for (const s of ['wien---', 'New--York', 'm%C3%BCnchen', 'a - b']) assert.equal(canonicalCitySlug(canonicalCitySlug(s)), canonicalCitySlug(s), `settled after one step: ${s}`)
})

const page = await import('../app/weather/[city]/page.js')
const open = async city => {
  reset()
  try { await page.default({ params: Promise.resolve({ city }) }); return { thrown: null, asked: seen.length } } catch (e) { return { thrown: e.message, asked: seen.length } }
}

test('the city page: another spelling moves for good to the one address, before anything is asked', async () => {
  for (const [given, to] of [['wien---', '/weather/wien'], ['new--york', '/weather/new-york'], ['Wien', '/weather/wien'], ['new%20york', '/weather/new-york'], ['M%C3%9CNCHEN', '/weather/m%C3%BCnchen']]) {
    const r = await open(given)
    assert.equal(r.thrown, `NEXT_PERMANENT_REDIRECT ${to}`, given)
    assert.equal(r.asked, 0, `${given}: no forecast is built for an address that moves`)
  }
})

test('the city page: the one address is served, in its percent form too, and never moves again', async () => {
  for (const city of ['wien', 'new-york', 'm%C3%BCnchen', 'münchen']) {
    const r = await open(city)
    assert.doesNotMatch(r.thrown ?? '', /REDIRECT/, city)
    assert.ok(r.asked > 0, `${city}: the page asks for its forecast`)
  }
})

test('the city page: an address with nothing in it, or one that cannot be read, is not found', async () => {
  for (const city of ['---', '%E0%A4%A']) {
    const r = await open(city)
    assert.equal(r.thrown, 'NEXT_NOT_FOUND', city)
    assert.equal(r.asked, 0)
  }
})

test('the page names its one address as canonical', async () => {
  assert.equal((await page.generateMetadata({ params: Promise.resolve({ city: 'wien' }) })).alternates.canonical, '/weather/wien')
  assert.equal((await page.generateMetadata({ params: Promise.resolve({ city: 'wien---' }) })).alternates.canonical, '/weather/wien')
  assert.equal((await page.generateMetadata({ params: Promise.resolve({ city: 'm%C3%BCnchen' }) })).alternates.canonical, '/weather/m%C3%BCnchen')
  assert.doesNotMatch((await page.generateMetadata({ params: Promise.resolve({ city: 'wien---' }) })).title, /Wien\s{2,}|Wien -/, 'no spaces or hyphens from the address in the name')
})

test('summit and airport pages take only an exact id or code: a stray hyphen is not found, never a page of its own', () => {
  // source-match-ok: the airport list is a JSON file the bundler loads; the lookup is one exact key
  const airports = JSON.parse(readFileSync(new URL('./airports.json', import.meta.url), 'utf8'))
  assert.ok(airports.LOWW && !airports['LOWW---'])
  const aviation = readFileSync(new URL('./aviation.js', import.meta.url), 'utf8')
  assert.ok(aviation.includes('const a = airports[icao?.toUpperCase()]') && aviation.includes('if (!a) return null'))
  const summit = readFileSync(new URL('../app/mountains/[peak]/page.js', import.meta.url), 'utf8')
  // source-match-ok: the summit page needs its forecast to render; its lookup is one exact comparison
  assert.match(summit, /const peakById = id => featured\.find\(p => p\.id === id && p\.kind !== 'hut'\) \?\? null/)
  assert.match(summit, /if \(!peak\) notFound\(\)/)
})
