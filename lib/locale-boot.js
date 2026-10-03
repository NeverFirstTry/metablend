// The pages are prerendered in English and °C; the browser swaps in the
// visitor's language and unit after hydration. For everyone who would see
// that swap, an inline script marks <html data-localizing> before first paint
// and globals.css keeps the content hidden until LocaleReady clears it (at
// most 1.2 s). Pure parts unit tested; the script mirrors needsLocalePass
// (and detectLang: Traditional Chinese phones read the English page).
import { LANGUAGES, preferredLang } from './i18n.js'
import { readCookie } from './prefs.js'

export function needsLocalePass({ cookie = '', navigatorLang = '' } = {}) {
  return preferredLang(readCookie(cookie, 'metablend_lang'), navigatorLang) !== 'en' || readCookie(cookie, 'metablend_unit') === 'F'
}

const CODES = JSON.stringify(LANGUAGES.map(l => l.code))
export const LOCALE_BOOT_SCRIPT = `try{var c=document.cookie,k=${CODES},l=(c.match(/(?:^|; *)metablend_lang=([a-z]+)/)||[])[1];if(k.indexOf(l)<0){var n=String(navigator.language||'').toLowerCase();l=n.split(/[-_,;]/)[0].trim();if(l==='zh'&&/-(tw|hk|mo|hant)/.test(n))l='en'}if(k.indexOf(l)<0)l='en';if(l!=='en'||/(?:^|; *)metablend_unit=F(?:;|$)/.test(c))document.documentElement.dataset.localizing='1'}catch(e){}`
