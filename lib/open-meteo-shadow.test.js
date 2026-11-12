// The comparison run (lib/open-meteo.js, "shadow mode"): the public service keeps answering, a share of
// the requests is asked from our own server as well and the two answers are compared. What a caller
// gets never comes from our server, and never waits for it.
import './test-jsx-hooks.js'
import { test } from 'node:test'
import assert from 'node:assert/strict'

// the counter and the error log write to the database: an address for its client (the fake answers it)
process.env.NEXT_PUBLIC_SUPABASE_URL = 'https://proj.supabase.co'
process.env.SUPABASE_SERVICE_ROLE_KEY = 'service-key'
const { openMeteoFetch, compareAnswers, shadowShare, resetSelf, resetMirror } = await import('./open-meteo.js')
const { NOTE_SCOPES } = await import('./health.js')

const SELF = 'https://weather.example.net'
const KEYS = ['OPEN_METEO_SELF', 'OPEN_METEO_PUBLIC', 'OPEN_METEO_SELF_ID', 'OPEN_METEO_SELF_SECRET', 'OPEN_METEO_SELF_TIMEOUT_MS', 'OPEN_METEO_SHADOW']
const ON = { OPEN_METEO_SELF: SELF, OPEN_METEO_SELF_ID: 'id-123', OPEN_METEO_SELF_SECRET: 'secret-456', OPEN_METEO_SHADOW: '1' }
const hours = ['2026-11-20T10:00', '2026-11-20T11:00', '2026-11-20T12:00']
const answer = temps => ({ latitude: 47.07, longitude: 12.69, hourly: { time: hours, temperature_2m_icon_d2: temps, pressure_msl_icon_d2: [1013.2, 1013.0, 1012.6] } })
const json = (body, status = 200) => new Response(JSON.stringify(body), { status, headers: { 'content-type': 'application/json' } })
const fromSelf = url => url.startsWith(SELF)
let n = 0
// a different place per request (the gate shares one in-flight request between callers of one URL)
const spot = () => `https://api.open-meteo.com/v1/forecast?latitude=${(47.0712 + ++n * 0.01).toFixed(4)}&longitude=12.6939&hourly=temperature_2m,pressure_msl&models=icon_d2`
const until = async (ok, ms = 2000) => { const end = Date.now() + ms; while (!ok() && Date.now() < end) await new Promise(r => setTimeout(r, 5)) }

// Runs `fn` with the settings and a faked network; reply(url, init) answers each outside request.
// counted: the counter's rows; notes: what went to the error log; asked: the outside requests.
async function withNet(settings, reply, fn) {
  const before = Object.fromEntries(KEYS.map(k => [k, process.env[k]]))
  for (const k of KEYS) delete process.env[k]
  Object.assign(process.env, settings)
  const realFetch = globalThis.fetch, realError = console.error
  const asked = [], counted = [], notes = []
  console.error = () => {} // logError also prints; keep the test output readable
  globalThis.fetch = async (input, init = {}) => {
    const url = String(input?.url ?? input)
    if (url.includes('/rest/v1/')) {
      if (url.includes('bump_open_meteo_calls')) counted.push(JSON.parse(init.body))
      if (url.includes('/error_log')) notes.push(JSON.parse(init.body))
      return new Response(url.includes('/rpc/') ? '0' : null, { status: url.includes('/rpc/') ? 200 : 201, headers: { 'content-type': 'application/json' } })
    }
    asked.push({ url, host: new URL(url).host, headers: Object.fromEntries(new Headers(init.headers ?? {})), redirect: init.redirect })
    return reply(url, init)
  }
  resetSelf(); resetMirror()
  try {
    await fn({ asked, counted, notes })
  } finally {
    await new Promise(r => setTimeout(r, 10))
    globalThis.fetch = realFetch
    console.error = realError
    for (const k of KEYS) { if (before[k] === undefined) delete process.env[k]; else process.env[k] = before[k] }
    resetSelf(); resetMirror()
  }
}
const kinds = counted => counted.map(c => c.p_kind).sort()

test('compareAnswers: same within rounding, differing, missing, other hours, no answer', () => {
  const pub = answer([4.1, 4.6, 5.2])
  assert.equal(compareAnswers(pub, answer([4.1, 4.6, 5.2])).result, 'same')
  assert.equal(compareAnswers(pub, answer([4.2, 4.5, 5.2])).result, 'same', 'a rounding step apart')
  // large values: one per cent
  assert.equal(compareAnswers(pub, { ...answer([4.1, 4.6, 5.2]), hourly: { ...pub.hourly, pressure_msl_icon_d2: [1015, 1013, 1012.6] } }).result, 'same')
  const differs = compareAnswers(pub, answer([4.1, 5.4, 5.2]))
  assert.deepEqual([differs.result, differs.values, differs.differ, differs.maxDiff, differs.worst], ['differ', 6, 1, 0.8, 'hourly.temperature_2m_icon_d2'])
  const lacks = compareAnswers(pub, answer([4.1, null, 5.2]))
  assert.deepEqual([lacks.result, lacks.missing, lacks.missingKeys], ['missing', 1, ['hourly.temperature_2m_icon_d2']])
  const noModel = compareAnswers(pub, { hourly: { time: hours, pressure_msl_icon_d2: [1013.2, 1013.0, 1012.6] } })
  assert.deepEqual([noModel.result, noModel.missing], ['missing', 3], 'a model our server does not have')
  // a value the public service does not have either is not counted
  assert.equal(compareAnswers(answer([4.1, null, 5.2]), answer([4.1, null, 5.2])).values, 5)
  const shifted = compareAnswers(pub, { hourly: { ...pub.hourly, time: ['2026-11-20T11:00', '2026-11-20T12:00', '2026-11-20T13:00'] } })
  assert.deepEqual([shifted.result, shifted.worst], ['differ', 'hourly.time'])
  assert.equal(compareAnswers(pub, null).result, 'failed')
  // heights are one list; current values are single
  assert.equal(compareAnswers({ elevation: [3798, 2100] }, { elevation: [3798, 2140] }).result, 'differ')
  assert.equal(compareAnswers({ current: { time: 't', temperature_2m: 4.1 } }, { current: { time: 't', temperature_2m: 4.1 } }).result, 'same')
})

test('shadowShare: a share between 0 and 1, and nothing while the public service is off', () => {
  assert.equal(shadowShare({ OPEN_METEO_SHADOW: '0.2' }), 0.2)
  assert.equal(shadowShare({ OPEN_METEO_SHADOW: '1' }), 1)
  for (const v of [undefined, '', '0', '-1', '2', 'on']) assert.equal(shadowShare({ OPEN_METEO_SHADOW: v }), 0)
  assert.equal(shadowShare({ OPEN_METEO_SHADOW: '0.2', OPEN_METEO_PUBLIC: 'off' }), 0)
})

test('the caller gets the public answer, without waiting for our server; our server is asked afterwards, with the token, and the pair is counted', async () => {
  let selfDone = false
  await withNet(ON, async u => {
    if (!fromSelf(u)) return json(answer([4.1, 4.6, 5.2]))
    await new Promise(r => setTimeout(r, 60))
    selfDone = true
    return json(answer([9.9, 9.9, 9.9])) // not what a visitor may ever see
  }, async ({ asked, counted }) => {
    const url = spot()
    const res = await openMeteoFetch(url, { kind: 'outlook' })
    assert.equal(selfDone, false, 'answered before our server did')
    assert.deepEqual((await res.json()).hourly.temperature_2m_icon_d2, [4.1, 4.6, 5.2])
    await until(() => counted.length >= 3)
    assert.deepEqual(asked.map(a => a.host), ['api.open-meteo.com', 'weather.example.net'])
    assert.equal(asked[1].url, url.replace('https://api.open-meteo.com', SELF))
    assert.equal(asked[1].headers['cf-access-client-secret'], 'secret-456')
    assert.equal(asked[1].redirect, 'error')
    assert.equal(asked[0].headers['cf-access-client-secret'], undefined, 'the token does not go to the public service')
    assert.deepEqual(kinds(counted), ['mirror:1s', 'mirror:differ', 'outlook'])
    assert.ok(counted.filter(c => c.p_kind.startsWith('mirror:')).every(c => c.p_calls === 0), 'nothing added to the public bill')
  })
})

test('a pair that differs is noted in the error log, with the place kept to one decimal', async () => {
  await withNet(ON, u => json(answer(fromSelf(u) ? [4.1, 5.4, 5.2] : [4.1, 4.6, 5.2])), async ({ counted, notes }) => {
    const url = spot()
    await openMeteoFetch(url, { kind: 'summit' })
    await until(() => notes.length >= 1)
    assert.equal(notes.length, 1)
    assert.equal(notes[0].scope, 'open-meteo.mirror')
    assert.ok(NOTE_SCOPES.includes(notes[0].scope), 'a note, not a failure: the health address ignores it and the cleanup keeps it 7 days')
    assert.match(notes[0].message, /our server, summit: 1 of 6 values differ, most in hourly\.temperature_2m_icon_d2 \(by 0\.8\)/)
    assert.equal(notes[0].meta.place, `${Number(new URL(url).searchParams.get('latitude')).toFixed(1)};12.7`)
    assert.ok(!JSON.stringify(notes[0]).includes(new URL(url).searchParams.get('latitude')), 'the exact position is not in the note')
    assert.equal(notes[0].meta.models, 'icon_d2')
    assert.deepEqual(kinds(counted), ['mirror:1s', 'mirror:differ', 'summit'])
  })
})

test('the same answer: counted, nothing noted', async () => {
  await withNet(ON, () => json(answer([4.1, 4.6, 5.2])), async ({ counted, notes }) => {
    await openMeteoFetch(spot(), { kind: 'forecast' })
    await until(() => counted.length >= 3)
    assert.deepEqual(kinds(counted), ['forecast', 'mirror:1s', 'mirror:same'])
    assert.equal(notes.length, 0)
  })
})

test('our server fails or lacks a model: the caller is not touched, the pair is counted as failed or missing', async () => {
  for (const [selfReply, kind] of [
    [() => new Response('boom', { status: 500 }), 'mirror:failed'],
    [() => { throw new TypeError('fetch failed') }, 'mirror:failed'],
    [() => json({ hourly: { time: hours, pressure_msl_icon_d2: [1013.2, 1013.0, 1012.6] } }), 'mirror:missing'],
  ]) {
    await withNet(ON, u => (fromSelf(u) ? selfReply() : json(answer([4.1, 4.6, 5.2]))), async ({ counted, notes }) => {
      const res = await openMeteoFetch(spot(), { kind: 'outlook' })
      assert.equal(res.status, 200)
      assert.deepEqual((await res.json()).hourly.temperature_2m_icon_d2, [4.1, 4.6, 5.2])
      await until(() => notes.length >= 1)
      assert.ok(kinds(counted).includes(kind), kind)
      // how long it took is counted only when it answered
      assert.equal(kinds(counted).some(k => /^mirror:(1s|2s|4s|slow)$/.test(k)), kind === 'mirror:missing')
      assert.equal(notes[0].meta.result, kind.slice(7))
    })
  }
})

test('one request in five: the share decides, and a failed public answer is not compared', async t => {
  let roll = 0.19
  t.mock.method(Math, 'random', () => roll)
  await withNet({ ...ON, OPEN_METEO_SHADOW: '0.2' }, () => json(answer([4.1, 4.6, 5.2])), async ({ asked, counted }) => {
    await openMeteoFetch(spot(), { kind: 'forecast' })
    await until(() => counted.length >= 3)
    assert.equal(asked.filter(a => a.host === 'weather.example.net').length, 1)
    roll = 0.21
    await openMeteoFetch(spot(), { kind: 'forecast' })
    await new Promise(r => setTimeout(r, 30))
    assert.equal(asked.filter(a => a.host === 'weather.example.net').length, 1, 'not this one')
  })
  roll = 0
  await withNet(ON, u => (fromSelf(u) ? json(answer([4.1, 4.6, 5.2])) : new Response('{"error":true,"reason":"Too many concurrent requests"}', { status: 429 })), async ({ asked }) => {
    assert.equal((await openMeteoFetch(spot(), { kind: 'forecast' })).status, 429)
    await new Promise(r => setTimeout(r, 30))
    assert.deepEqual(asked.map(a => a.host), ['api.open-meteo.com'])
  })
})

test('at most two comparisons at a time, the rest are skipped; and no more than twenty notes a day', async () => {
  await withNet(ON, async u => {
    if (fromSelf(u)) await new Promise(r => setTimeout(r, 80))
    return json(answer(fromSelf(u) ? [0, 0, 0] : [4.1, 4.6, 5.2]))
  }, async ({ asked, counted, notes }) => {
    await Promise.all([spot(), spot(), spot(), spot()].map(u => openMeteoFetch(u, { kind: 'forecast' })))
    await until(() => counted.filter(c => c.p_kind === 'mirror:differ').length >= 2)
    await new Promise(r => setTimeout(r, 120))
    assert.equal(asked.filter(a => a.host === 'weather.example.net').length, 2, 'two of four, the other two skipped')
    // one after another from here: 24 more differing pairs, 20 notes in all
    for (let i = 0; i < 24; i++) { const before = counted.length; await openMeteoFetch(spot(), { kind: 'forecast' }); await until(() => counted.length >= before + 3) }
    await new Promise(r => setTimeout(r, 30))
    assert.equal(counted.filter(c => c.p_kind === 'mirror:differ').length, 26)
    assert.equal(notes.length, 20)
  })
})

test('with the public service off there is no comparison: our server answers the caller', async () => {
  await withNet({ ...ON, OPEN_METEO_PUBLIC: 'off' }, () => json(answer([4.1, 4.6, 5.2])), async ({ asked, counted }) => {
    await openMeteoFetch(spot(), { kind: 'outlook' })
    await new Promise(r => setTimeout(r, 30))
    assert.deepEqual(asked.map(a => a.host), ['weather.example.net'])
    assert.deepEqual(kinds(counted), ['self:outlook'])
  })
})
