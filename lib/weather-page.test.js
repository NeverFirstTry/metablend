import { test } from 'node:test'
import assert from 'node:assert/strict'
import { readForecast } from './weather-page.js'

const json = (body, status = 200) => new Response(JSON.stringify(body), { status, headers: { 'content-type': 'application/json' } })

test('readForecast — a forecast comes back as it is', async () => {
  assert.deepEqual(await readForecast(json({ city: 'Vienna', temp: 10 }), true), { city: 'Vienna', temp: 10 })
})

test('readForecast — "not found" for a slug that is not one of our cities is a 404 page', async () => {
  assert.equal(await readForecast(json({ error: 'not found' }, 404), false), 'unknown')
  assert.equal(await readForecast(json({ error: 'not found' }), false), 'unknown')
})

test('readForecast — "not found" for one of our cities means the geocoder failed just now: an error, so the cached page stays', async () => {
  await assert.rejects(readForecast(json({ error: 'not found' }, 404), true), /geocoder/)
  await assert.rejects(readForecast(json({ error: 'not found' }), true), /geocoder/)
})

test('readForecast — any other failure is an error (500 on a first visit, which crawlers retry)', async () => {
  await assert.rejects(readForecast(json({ error: 'busy' }, 502), false), /502/)
})
