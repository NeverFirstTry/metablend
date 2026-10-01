// Push inside the app (browser side). Plugins are dynamic-imported only when
// running natively. The device key lives in native storage (Preferences):
// iOS may purge WebView storage, and losing the key means losing settings.
import { isNative } from './native'

const KEY = 'mb_device_key', VIEWS = 'mb_city_views', DISMISSED = 'mb_push_prompt_off', OPTED = 'mb_push_on'
const prefs = async () => (await import('@capacitor/preferences')).Preferences
const plugin = async () => (await import('@capacitor/push-notifications')).PushNotifications

async function deviceKey() {
  const P = await prefs()
  const { value } = await P.get({ key: KEY })
  if (value) return value
  const bytes = crypto.getRandomValues(new Uint8Array(32))
  const key = btoa(String.fromCharCode(...bytes)).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '')
  await P.set({ key: KEY, value: key })
  return key
}

export async function pushApi(path, { method = 'GET', body } = {}) {
  const res = await fetch(`/api/push/${path}`, {
    method,
    headers: { 'x-device-key': await deviceKey(), ...(body ? { 'Content-Type': 'application/json' } : {}) },
    body: body ? JSON.stringify(body) : undefined,
  })
  return { status: res.status, json: await res.json().catch(() => ({})) }
}

const platform = () => window.Capacitor?.getPlatform?.()

export async function permission() {
  if (!isNative()) return 'unavailable'
  try { return (await (await plugin()).checkPermissions()).receive } catch { return 'unavailable' }
}

// register() → the token arrives in the 'registration' event
async function tokenOnce(P) {
  return new Promise((resolve, reject) => {
    const timer = setTimeout(() => reject(new Error('no token')), 15000)
    let subs = []
    const done = fn => v => { clearTimeout(timer); subs.forEach(s => s.remove()); fn(v) }
    Promise.all([
      P.addListener('registration', done(t => resolve(t.value))),
      P.addListener('registrationError', done(e => reject(new Error(e?.error ?? 'registration failed')))),
    ]).then(s => { subs = s; return P.register() }).catch(reject)
  })
}

async function register(P, { lang, unit }) {
  const token = await tokenOnce(P)
  const r = await pushApi('register', { method: 'POST', body: { token, platform: platform(), lang, unit } })
  return r.status === 200
}

export async function enablePush({ lang, unit }) {
  if (!isNative()) return { ok: false, reason: 'error' }
  try {
    const P = await plugin()
    let { receive } = await P.checkPermissions()
    if (receive === 'prompt' || receive === 'prompt-with-rationale') receive = (await P.requestPermissions()).receive
    if (receive !== 'granted') return { ok: false, reason: 'denied' }
    if (!(await register(P, { lang, unit }))) return { ok: false, reason: 'error' }
    await (await prefs()).set({ key: OPTED, value: '1' }) // opted in here, not just allowed by the OS
    return { ok: true }
  } catch {
    return { ok: false, reason: 'error' }
  }
}

const CHANNELS = [
  { id: 'alerts', name: 'Weather alerts', importance: 4 },
  { id: 'briefing', name: 'Morning briefing', importance: 3 },
  { id: 'hikes', name: 'Hike alerts', importance: 3 },
]

// At app start: channels, tap handling, and a fresh token when allowed.
export async function initPush({ lang, unit, onOpen }) {
  if (!isNative()) return () => {}
  try {
    const P = await plugin()
    if (platform() === 'android') for (const c of CHANNELS) await P.createChannel(c).catch(() => {})
    const tap = await P.addListener('pushNotificationActionPerformed', a => {
      const url = a?.notification?.data?.url
      if (typeof url === 'string' && url.startsWith('/')) onOpen(url)
    })
    // re-register only phones that opted in here: Android 12 and older report
    // "granted" without ever asking, and nothing is stored before a yes
    const opted = !!(await (await prefs()).get({ key: OPTED })).value
    if (opted && (await P.checkPermissions()).receive === 'granted') register(P, { lang, unit }).catch(() => {})
    return () => tap.remove()
  } catch {
    return () => {}
  }
}

export async function bumpCityView(city) {
  if (!isNative() || !city) return
  try {
    const P = await prefs()
    const counts = JSON.parse((await P.get({ key: VIEWS })).value ?? '{}')
    counts[city] = (counts[city] ?? 0) + 1
    await P.set({ key: VIEWS, value: JSON.stringify(counts) })
  } catch { /* counting is a nicety */ }
}

export async function promptState() {
  if (!isNative()) return { views: 0, topCity: null, dismissed: true, optedIn: false }
  const P = await prefs()
  const counts = JSON.parse((await P.get({ key: VIEWS })).value ?? '{}')
  const entries = Object.entries(counts).sort((a, b) => b[1] - a[1])
  return { views: entries.reduce((s, [, n]) => s + n, 0), topCity: entries[0]?.[0] ?? null, dismissed: !!(await P.get({ key: DISMISSED })).value, optedIn: !!(await P.get({ key: OPTED })).value }
}

export async function dismissPrompt() {
  if (isNative()) await (await prefs()).set({ key: DISMISSED, value: '1' })
}

// iOS can jump straight to the app's page in Settings; Android has no
// official way, so the UI explains the path there instead.
export async function openSystemSettings() {
  if (platform() !== 'ios') return false
  try { await (await import('@capacitor/app-launcher')).AppLauncher.openUrl({ url: 'app-settings:' }); return true } catch { return false }
}
