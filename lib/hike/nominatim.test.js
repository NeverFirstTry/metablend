import { test } from 'node:test'
import assert from 'node:assert/strict'
import { makeNominatim, NOMINATIM_UA, supabaseNominatimStore, GAP_MS } from './nominatim.js'

// a fake of the database (cache table + the gate function) and of the network
function world({ cached = {}, slot = () => ({ data: 0, error: null }) } = {}) {
  const log = []
  const db = {
    cacheGet: async key => { log.push(`cache? ${key}`); return cached[key] ?? null },
    cachePut: async (key, body, askedAt) => { log.push(`cache! ${key} asked ${typeof askedAt}`); cached[key] = body },
    slot: async () => { log.push('slot'); return slot() },
  }
  const fetchJson = async (url, init) => { log.push(`GET ${url} ua=${init.headers['User-Agent']}`); return [{ name: 'x' }] }
  const sleep = async ms => { log.push(`wait ${ms}`) }
  return { log, nominatim: makeNominatim({ db, fetchJson, sleep, base: 'https://nominatim.test/search?format=jsonv2' }) }
}

test('nominatim — an answer in the shared cache: no request at all', async () => {
  const { log, nominatim } = world({ cached: { 'q=peak': [{ name: 'cached' }] } })
  assert.deepEqual(await nominatim('q=peak'), [{ name: 'cached' }])
  assert.deepEqual(log, ['cache? q=peak'])
})

test('nominatim — not cached: the global slot first, its wait, then one request as MetaBlend with a contact; the answer is kept', async () => {
  const { log, nominatim } = world({ slot: () => ({ data: 700, error: null }) })
  assert.deepEqual(await nominatim('q=peak'), [{ name: 'x' }])
  assert.deepEqual(log, ['cache? q=peak', 'slot', 'wait 700', `GET https://nominatim.test/search?format=jsonv2&q=peak ua=${NOMINATIM_UA}`, 'cache! q=peak asked number'])
  assert.match(NOMINATIM_UA, /MetaBlend/)
  assert.match(NOMINATIM_UA, /@/) // a contact address
})

test('nominatim — the queue is full (the gate says null): give up, never ask', async () => {
  const { log, nominatim } = world({ slot: () => ({ data: null, error: null }) })
  assert.equal(await nominatim('q=peak'), null)
  assert.ok(!log.some(l => l.startsWith('GET')))
})

test('nominatim — the database fails: no request (the limit is global or nothing)', async () => {
  const { log, nominatim } = world({ slot: () => ({ data: null, error: { code: '08006', message: 'connection failure' } }) })
  assert.equal(await nominatim('q=peak'), null)
  assert.ok(!log.some(l => l.startsWith('GET')))
})

test('nominatim — the gate isn\'t set up yet (SQL not run) or a local run may not write: this instance spaces its own requests', async () => {
  for (const error of [{ code: 'PGRST202', message: 'Could not find the function' }, { message: 'Error: Refused: a local run does not write to the production database' } /* as postgrest-js passes it on */]) {
    const { log, nominatim } = world({ slot: () => ({ data: null, error }) })
    assert.deepEqual(await nominatim('q=a'), [{ name: 'x' }])
    assert.deepEqual(await nominatim('q=b'), [{ name: 'x' }])
    assert.equal(log.filter(l => l.startsWith('GET')).length, 2)
    assert.ok(log.some(l => /^wait 1[12]\d\d$/.test(l)), log.join(' / ')) // the second ~1.25 s after the first
  }
})

test('supabaseNominatimStore — works with PostgREST builders, which can be awaited but have no .catch', async () => {
  const thenable = value => ({ then: (ok) => ok(value) }) // like a PostgrestBuilder
  const builder = { select: () => builder, eq: () => builder, gte: () => builder, maybeSingle: () => thenable({ data: null, error: null }), upsert: () => thenable({ error: null }) }
  const fake = { from: () => builder, rpc: () => thenable({ data: 0, error: null }) }
  const nominatim = makeNominatim({ db: supabaseNominatimStore(fake), fetchJson: async () => [{ name: 'x' }], sleep: async () => {}, base: 'https://n.test/search?f=1' })
  assert.deepEqual(await nominatim('q=peak'), [{ name: 'x' }])
})

test('supabaseNominatimStore — asks the gate for GAP_MS slots and stores when each request went out; without that column yet, stores the answer anyway', async () => {
  assert.equal(GAP_MS, 1250)
  const calls = []
  const thenable = value => ({ then: ok => ok(value) })
  let hasColumn = false
  const builder = {
    upsert: row => {
      calls.push(Object.keys(row).sort().join(','))
      return thenable({ error: !hasColumn && 'asked_at' in row ? { code: 'PGRST204', message: 'Could not find the asked_at column' } : null })
    },
  }
  const fake = { from: () => builder, rpc: (name, args) => { calls.push(`${name} ${JSON.stringify(args)}`); return thenable({ data: 0, error: null }) } }
  const store = supabaseNominatimStore(fake)
  await store.slot()
  await store.cachePut('q=peak', [1], Date.parse('2026-10-29T12:00:00Z'))
  hasColumn = true
  await store.cachePut('q=hut', [2], Date.parse('2026-10-29T12:00:01Z'))
  assert.deepEqual(calls, ['nominatim_slot {"max_wait_ms":4000,"gap_ms":1250}', 'asked_at,body,fetched_at,key', 'body,fetched_at,key', 'asked_at,body,fetched_at,key'])
})
