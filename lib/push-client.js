// Push inside the app (browser side). Plugins are dynamic-imported only when
// running natively. The device key lives in native storage (Preferences):
// iOS may purge WebView storage, and losing the key means losing settings.
import { isNative } from './native'
import { loadPlugin } from './capacitor-plugin'
import { t } from './i18n'

const KEY = 'mb_device_key', VIEWS = 'mb_city_views', DISMISSED = 'mb_push_prompt_off', OPTED = 'mb_push_on'
// plugins arrive boxed ({ plugin }) — see capacitor-plugin.js for why
const prefs = () => loadPlugin(() => import('@capacitor/preferences'), 'Preferences')
const push = () => loadPlugin(() => import('@capacitor/push-notifications'), 'PushNotifications')

async function deviceKey() {
  const { plugin: P } = await prefs()
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
  try { return (await (await push()).plugin.checkPermissions()).receive } catch { return 'unavailable' }
}

// register() → the token arrives in the 'registration' event
async function tokenOnce(P) {
  return new Promise((resolve, reject) => {
    const timer = setTimeout(() => reject(new Error('no push token after 15 s')), 15000)
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
  if (r.status !== 200) throw new Error(`server ${r.status}${r.json?.error ? `: ${r.json.error}` : ''}`)
  return true
}

export async function enablePush({ lang, unit }) {
  if (!isNative()) return { ok: false, reason: 'error' }
  try {
    const { plugin: P } = await push()
    let { receive } = await P.checkPermissions()
    if (receive === 'prompt' || receive === 'prompt-with-rationale') receive = (await P.requestPermissions()).receive
    if (receive !== 'granted') return { ok: false, reason: 'denied' }
    await register(P, { lang, unit })
    await (await prefs()).plugin.set({ key: OPTED, value: '1' }) // opted in here, not just allowed by the OS
    return { ok: true }
  } catch (e) {
    // the reason travels along: Apple's / Google's registration error, the
    // token timeout or the server's answer — "check your connection" alone
    // hid that the build lacked the push entitlement
    return { ok: false, reason: 'error', detail: e?.message ?? String(e) }
  }
}

// Android lists these under the app's notification settings; creating one
// again only renames it, so the names follow the app language
const CHANNELS = [
  { id: 'alerts', label: 'notifAlerts', importance: 4 },
  { id: 'briefing', label: 'notifBriefing', importance: 3 },
  { id: 'hikes', label: 'notifHikes', importance: 3 },
]

// At app start: channels, tap handling, and a fresh token when allowed.
export async function initPush({ lang, unit, onOpen }) {
  if (!isNative()) return () => {}
  try {
    const { plugin: P } = await push()
    if (platform() === 'android') for (const { id, label, importance } of CHANNELS) await P.createChannel({ id, name: t(lang, label), importance }).catch(() => {})
    const tap = await P.addListener('pushNotificationActionPerformed', a => {
      const url = a?.notification?.data?.url
      if (typeof url === 'string' && url.startsWith('/')) onOpen(url)
    })
    // re-register only phones that opted in here: Android 12 and older report
    // "granted" without ever asking, and nothing is stored before a yes
    const opted = !!(await (await prefs()).plugin.get({ key: OPTED })).value
    if (opted && (await P.checkPermissions()).receive === 'granted') register(P, { lang, unit }).catch(() => {})
    return () => tap.remove()
  } catch {
    return () => {}
  }
}

export async function bumpCityView(city) {
  if (!isNative() || !city) return
  try {
    const { plugin: P } = await prefs()
    const counts = JSON.parse((await P.get({ key: VIEWS })).value ?? '{}')
    counts[city] = (counts[city] ?? 0) + 1
    await P.set({ key: VIEWS, value: JSON.stringify(counts) })
  } catch { /* counting is a nicety */ }
}

export async function promptState() {
  if (!isNative()) return { views: 0, topCity: null, dismissed: true, optedIn: false }
  const { plugin: P } = await prefs()
  const counts = JSON.parse((await P.get({ key: VIEWS })).value ?? '{}')
  const entries = Object.entries(counts).sort((a, b) => b[1] - a[1])
  return { views: entries.reduce((s, [, n]) => s + n, 0), topCity: entries[0]?.[0] ?? null, dismissed: !!(await P.get({ key: DISMISSED })).value, optedIn: !!(await P.get({ key: OPTED })).value }
}

export async function dismissPrompt() {
  if (isNative()) await (await prefs()).plugin.set({ key: DISMISSED, value: '1' })
}

// iOS can jump straight to the app's page in Settings; Android has no
// official way, so the UI explains the path there instead.
export async function openSystemSettings() {
  if (platform() !== 'ios') return false
  try { await (await import('@capacitor/app-launcher')).AppLauncher.openUrl({ url: 'app-settings:' }); return true } catch { return false }
}
