import { test } from 'node:test'
import assert from 'node:assert/strict'
import { parseFeedback, feedbackOriginProblem, learnsFromReport, FEEDBACK_LEARN_WINDOW_MS } from './feedback.js'

const valid = { city: 'Vienna', actualTemp: 17, actualCond: 'cloudy', lat: 48.21, lon: 16.37 }

test('parseFeedback — a normal report passes through, city trimmed', () => {
  const r = parseFeedback({ ...valid, city: '  Vienna ' })
  assert.equal(r.ok, true)
  assert.deepEqual(r.value, { city: 'Vienna', actualTemp: 17, actualCond: 'cloudy', lat: 48.21, lon: 16.37 })
})

test('parseFeedback — non-object bodies are a 400, not a crash', () => {
  for (const body of [null, undefined, 'x', 42]) {
    const r = parseFeedback(body)
    assert.equal(r.ok, false)
    assert.equal(r.status, 400)
  }
})

test('parseFeedback — missing fields', () => {
  for (const drop of ['city', 'actualTemp', 'actualCond']) {
    const body = { ...valid }
    delete body[drop]
    assert.equal(parseFeedback(body).status, 400, drop)
  }
  // JSON.stringify turns NaN into null — that's a missing temperature, not 0 °C
  assert.equal(parseFeedback({ ...valid, actualTemp: null }).status, 400)
})

test('parseFeedback — temperature must be a real number', () => {
  // NaN comparisons are all false, so 'abc' used to slip past the range check
  // and score every source −2
  for (const actualTemp of ['abc', '17', true, [], {}, Infinity, NaN]) {
    const r = parseFeedback({ ...valid, actualTemp })
    assert.equal(r.ok, false, String(actualTemp))
    assert.equal(r.status, 400, String(actualTemp))
  }
})

test('parseFeedback — temperature sanity range stays a 422', () => {
  assert.equal(parseFeedback({ ...valid, actualTemp: -51 }).status, 422)
  assert.equal(parseFeedback({ ...valid, actualTemp: 61 }).status, 422)
  assert.equal(parseFeedback({ ...valid, actualTemp: -50 }).ok, true)
  assert.equal(parseFeedback({ ...valid, actualTemp: 60 }).ok, true)
})

test('parseFeedback — job sentinels and unknown conditions are rejected', () => {
  // a user report with the calibrate sentinel + yesterday's date used to be
  // able to switch off the daily calibration
  for (const actualCond of ['__calibrate__', '__meteostat__', 'lava', '<b>x</b>', 7]) {
    assert.equal(parseFeedback({ ...valid, actualCond }).status, 400, String(actualCond))
  }
})

test('parseFeedback — current condition keys and legacy German values are accepted', () => {
  for (const actualCond of ['sunny', 'clear', 'partlyCloudy', 'cloudy', 'overcast', 'rain', 'thunder', 'snow',
    'Sonnig', 'Klar', 'Leicht bewölkt', 'Bewölkt', 'Bedeckt', 'Regen', 'Gewitter', 'Schnee']) {
    assert.equal(parseFeedback({ ...valid, actualCond }).ok, true, actualCond)
  }
})

test('parseFeedback — city must be a short non-empty string', () => {
  for (const city of [{ toLowerCase: () => 'x' }, 42, ['Vienna'], '   ', 'x'.repeat(101)]) {
    assert.equal(parseFeedback({ ...valid, city }).status, 400, JSON.stringify(city))
  }
  assert.equal(parseFeedback({ ...valid, city: 'x'.repeat(100) }).ok, true)
})

test('parseFeedback — unusable coordinates become null', () => {
  const bad = parseFeedback({ ...valid, lat: '48.2', lon: 181 }).value
  assert.equal(bad.lat, null)
  assert.equal(bad.lon, null)
  const nan = parseFeedback({ ...valid, lat: NaN, lon: -181 }).value
  assert.equal(nan.lat, null)
  assert.equal(nan.lon, null)
  const edge = parseFeedback({ ...valid, lat: -90, lon: 180 }).value
  assert.equal(edge.lat, -90)
  assert.equal(edge.lon, 180)
  const absent = parseFeedback({ city: 'Vienna', actualTemp: 17, actualCond: 'cloudy' }).value
  assert.equal(absent.lat, null)
  assert.equal(absent.lon, null)
})

test('parseFeedback — client-chosen region and report date are dropped', () => {
  // the server derives both; letting the client pick them steered which
  // weight bucket moved and which day a report counted for
  const r = parseFeedback({ ...valid, region: 'oceania', reportDate: '2020-01-01' })
  assert.equal(r.ok, true)
  assert.equal('region' in r.value, false)
  assert.equal('reportDate' in r.value, false)
})

const hdrs = h => new Headers(h)

test('feedbackOriginProblem — only JSON from MetaBlend\'s own pages (no silent posts from other sites)', () => {
  const ok = { 'content-type': 'application/json', 'sec-fetch-site': 'same-origin', origin: 'https://metablend.app' }
  assert.equal(feedbackOriginProblem(hdrs(ok)), null)
  assert.equal(feedbackOriginProblem(hdrs({ 'content-type': 'application/json; charset=utf-8' })), null) // no browser headers: a script, left to the rate limit
  assert.equal(feedbackOriginProblem(hdrs({ ...ok, origin: 'http://localhost:3123' })), null)
  // a page elsewhere posting through its visitors' browsers
  assert.equal(feedbackOriginProblem(hdrs({ ...ok, 'content-type': 'text/plain' }))?.status, 415)
  assert.equal(feedbackOriginProblem(hdrs({ 'sec-fetch-site': 'same-origin' }))?.status, 415)
  assert.equal(feedbackOriginProblem(hdrs({ ...ok, 'sec-fetch-site': 'cross-site' }))?.status, 403)
  assert.equal(feedbackOriginProblem(hdrs({ ...ok, 'sec-fetch-site': 'same-site' }))?.status, 403)
  assert.equal(feedbackOriginProblem(hdrs({ ...ok, origin: 'https://evil.example' }))?.status, 403)
  assert.equal(feedbackOriginProblem(hdrs({ ...ok, origin: 'https://metablend.app.evil.example' }))?.status, 403)
})

test('learnsFromReport — a city moves the weights at most once per half hour', () => {
  const now = Date.parse('2026-10-04T12:00:00Z')
  assert.equal(learnsFromReport(null, now), true)
  assert.equal(learnsFromReport('2026-10-04T11:20:00Z', now), true)
  assert.equal(learnsFromReport('2026-10-04T11:45:00Z', now), false)
  assert.equal(FEEDBACK_LEARN_WINDOW_MS, 30 * 60 * 1000)
})
