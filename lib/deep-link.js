// metablend://open?path=/… → the in-app path (pure — unit tested). Only the
// app's own scheme and host, and only same-site paths: a widget tap can't be
// turned into a jump to another site.
export function pathFromAppUrl(raw) {
  let u
  try { u = new URL(raw) } catch { return null }
  if (u.protocol !== 'metablend:' || u.hostname !== 'open') return null
  const path = u.searchParams.get('path') ?? ''
  return path.startsWith('/') && !path.startsWith('//') && !path.includes('\\') ? path : null
}
