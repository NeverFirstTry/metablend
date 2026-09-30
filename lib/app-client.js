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
