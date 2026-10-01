import { test } from 'node:test'
import assert from 'node:assert/strict'
import { fetchSummitRaw, CORE_MODELS } from './sources.js'
import { fetchOpenMeteoMultiRaw } from '../outlook/sources.js'

// a stand-in for getJson that records each URL and answers from a list
const fakeGet = answers => {
  const urls = []
  const get = async url => { urls.push(url); return answers.shift() ?? null }
  return { get, urls }
}
const modelsOf = url => new URL(url).searchParams.get('models').split(',')

test('fetchSummitRaw — all models first; when that fails, the three core models', async () => {
  const ok = fakeGet([{ hourly: { time: [] } }])
  assert.deepEqual(await fetchSummitRaw(47, 12, 3000, ok.get), { hourly: { time: [] } })
  assert.equal(ok.urls.length, 1)
  assert.equal(modelsOf(ok.urls[0]).length, 10)

  const slim = fakeGet([null, { slim: true }])
  assert.deepEqual(await fetchSummitRaw(47, 12, 3000, slim.get), { slim: true, fallback: 'core' })
  assert.deepEqual(modelsOf(slim.urls[1]), CORE_MODELS)

  const none = fakeGet([null, null])
  assert.equal(await fetchSummitRaw(47, 12, 3000, none.get), null)
})

test('fetchOpenMeteoMultiRaw — the same fallback for the city outlook', async () => {
  const slim = fakeGet([null, { slim: true }])
  assert.deepEqual(await fetchOpenMeteoMultiRaw(46.8, 12.8, slim.get), { slim: true, fallback: 'core' })
  assert.deepEqual(modelsOf(slim.urls[1]), CORE_MODELS)
})
