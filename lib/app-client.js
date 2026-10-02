// Is this request running inside the MetaBlend app? The Capacitor shell
// appends 'MetaBlendApp' to its user agent; '?app=1' sets a cookie that
// counts the same, so the app view can be tested in any browser (?app=0
// clears it). Pure — shared by server components and tests.
export const APP_UA = 'MetaBlendApp'
export const APP_COOKIE = 'metablend_app'

export function isAppRequest({ userAgent = '', cookie = '', appParam = null } = {}) {
  if (appParam === '1') return true
  if (appParam === '0') return false
  return userAgent.includes(APP_UA) || new RegExp(`(?:^|;\\s*)${APP_COOKIE}=1(?:;|$)`).test(cookie)
}

// Inline <script> for the root layout, run before first paint: handles the
// ?app=1 / ?app=0 test switch and marks <html data-app> inside the app (never
// in an iframe, e.g. the embed preview). viewport-fit=cover is in every page's
// HTML instead: added here at runtime it didn't take on iOS (the app's header
// sat under the status bar), and globals.css pads every page by the safe area.
// The app's user agent also sets the app cookie: Android WebView drops the
// custom user agent on some requests (service-worker fetches), cookies stay.
export const APP_BOOT_SCRIPT = `try{
var d=document,q=location.search,on=/[?&]app=1(&|$)/.test(q),off=/[?&]app=0(&|$)/.test(q),ua=/${APP_UA}/.test(navigator.userAgent);
if(on||(ua&&!off))d.cookie='${APP_COOKIE}=1; path=/; max-age=2592000; samesite=lax';
if(off)d.cookie='${APP_COOKIE}=; path=/; max-age=0';
var app=window.top===window.self&&!off&&(ua||/(?:^|; *)${APP_COOKIE}=1(?:;|$)/.test(d.cookie));
if(app)d.documentElement.dataset.app='1'
}catch(e){}`

// The city the Forecast tab starts with: a ?city= deep link, else — inside
// the app, where tabs reload the page — the city last looked at this session
// (a notification or widget tap counts), then the last one searched.
export function startCity({ deepLink, inApp, last = null, recent }) {
  if (deepLink) return deepLink
  if (!inApp) return null
  return last || (recent?.length ? recent[0] : null)
}
