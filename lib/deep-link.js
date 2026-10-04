// metablend://open?path=/… → the in-app path (pure — unit tested). Only the
// app's own scheme and host, and only same-site paths: a widget tap can't be
// turned into a jump to another site.
export function pathFromAppUrl(raw) {
  let u
  try { u = new URL(raw) } catch { return null }
  if (u.protocol !== 'metablend:' || u.hostname !== 'open') return null
  const path = u.searchParams.get('path') ?? ''
  return isSitePath(path) ? path : null
}

// A path on metablend.app and nothing else: URL parsing drops tabs and line
// breaks and reads "\" as "/", so "/<tab>/evil.com" would become //evil.com —
// control characters and backslashes are refused, and the result must still
// resolve to this site. Also guards notification taps (lib/push-client.js).
const SITE = 'https://metablend.app'
export function isSitePath(path) {
  if (typeof path !== 'string' || !path.startsWith('/') || /[\u0000-\u001f\u007f\\]/.test(path)) return false
  try { return new URL(path, SITE).origin === SITE } catch { return false }
}
