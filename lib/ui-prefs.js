// The UI language and temperature unit once a page has worked them out (and,
// for the language, loaded its texts), shared by every component while the
// page runs. useLang / useUnit read it in their first render, so a tab or page
// opened later starts in the right language and unit — no English / °C frame
// before an effect corrects it (a tester saw the English Hiking page flash on
// every tab switch). Unknown (null) until then: the first page load renders
// English like the server and hides behind LocaleReady until it's swapped.
import { preferredLang } from './i18n.js'

let prefs = { lang: null, unit: null }
const subscribers = new Set()

export function publishPrefs(patch) {
  const next = { ...prefs, ...patch }
  if (next.lang === prefs.lang && next.unit === prefs.unit) return
  prefs = next
  subscribers.forEach(f => f())
}

export function subscribePrefs(f) {
  subscribers.add(f)
  return () => subscribers.delete(f)
}

export const knownLang = () => prefs.lang
export const knownUnit = () => prefs.unit

const cookieValue = (cookie, name) => {
  const m = cookie.match(new RegExp(`(?:^|; )${name}=([^;]*)`))
  return m ? decodeURIComponent(m[1]) : null
}

// what the cookies ask for — no language cookie = "System": the phone's language
export function cookiePrefs(cookie, navigatorLang) {
  return {
    lang: preferredLang(cookieValue(cookie, 'metablend_lang'), navigatorLang),
    unit: cookieValue(cookie, 'metablend_unit') === 'F' ? 'F' : 'C',
  }
}
