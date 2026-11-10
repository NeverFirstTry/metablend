// Test helper (not a test): calls a route handler for real with every outside call faked, the
// pattern of forecast-route.test.js. Import it before the route: the env and the fetch fake must be
// in place when lib/supabase.js and the route load.
process.env.NEXT_PUBLIC_SUPABASE_URL = 'https://proj.supabase.co'
process.env.SUPABASE_SERVICE_ROLE_KEY = 'service-key'
process.env.CRON_SECRET = 'cron-secret'
process.env.CALIBRATE_SECRET = 'calibrate-secret'
process.env.SELF_BASE = 'http://self.test'
for (const k of ['WEBHOOK_URL', 'VISUAL_CROSSING_KEY', 'RAPIDAPI_KEY', 'OPENWEATHERMAP_API_KEY', 'WEATHERAPI_KEY', 'PIRATE_WEATHER_KEY', 'VAPID_PRIVATE_KEY', 'FCM_SERVICE_ACCOUNT', 'APNS_KEY']) delete process.env[k]

export const json = (body, status = 200) => new Response(JSON.stringify(body), { status, headers: { 'content-type': 'application/json' } })

// every request the code under test sent: { url (decoded), method, body, at }
export const seen = []
// per-test answers: a function (call) => Response | undefined; undefined falls through to the defaults
let answer = () => undefined
export const answerWith = fn => { answer = fn }
export const reset = () => { seen.length = 0; answer = () => undefined }

globalThis.fetch = async (input, init = {}) => {
  const call = { url: decodeURIComponent(String(input?.url ?? input)), method: init.method ?? input?.method ?? 'GET', body: init.body == null ? null : String(init.body), at: Date.now() }
  seen.push(call)
  const own = await answer(call)
  if (own) return own
  // the database's REST API: empty reads, accepted writes; everything else outside is not there
  if (call.url.includes('proj.supabase.co/rest/v1/')) return call.method === 'GET' ? json([]) : new Response(null, { status: call.method === 'POST' ? 201 : 204 })
  return new Response('not found', { status: 404 })
}

// a scheduled job's request, carrying both job secrets (cron bearer and calibrate key)
export const jobRequest = path => new Request(`https://metablend.app${path}`, { headers: { authorization: 'Bearer cron-secret', 'x-calibrate-key': 'calibrate-secret' } })

// the ISO time a filter like `created_at=lt.<iso>` in a recorded call compares against
export const cutoff = (call, column) => call.url.match(new RegExp(`${column}=lt\\.([^&]+)`))?.[1]
