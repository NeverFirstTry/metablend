// Pull Leaflet off the CDN once and hand back the global `L`. Keeping it out
// of the bundle dodges the whole "window is not defined" SSR mess.
const LEAFLET_VERSION = '1.9.4'
const CSS_URL = `https://unpkg.com/leaflet@${LEAFLET_VERSION}/dist/leaflet.css`
const JS_URL = `https://unpkg.com/leaflet@${LEAFLET_VERSION}/dist/leaflet.js`
// the hashes leafletjs.com publishes for 1.9.4: a changed file from the CDN is
// refused (in the app this script would run next to the native bridge)
const CSS_SRI = 'sha256-p4NxAoJBhIIN+hmNHrzRCf9tD/miZyoHS5obTRR9BMY='
const JS_SRI = 'sha256-20nQCchB9co0qIjJZRGuk2/Z9VM+kNiyxNV1lvTlZBo='

let leafletPromise = null

export function loadLeaflet() {
  if (typeof window === 'undefined') return Promise.resolve(null)
  if (window.L) return Promise.resolve(window.L)
  if (leafletPromise) return leafletPromise

  // resolves null when the script can't load (callers show no map) and forgets
  // the failure, so the next map tries again instead of failing for good
  leafletPromise = new Promise(resolve => {
    const fail = () => { leafletPromise = null; resolve(null) }
    // CSS
    if (!document.querySelector(`link[href="${CSS_URL}"]`)) {
      const link = document.createElement('link')
      link.rel = 'stylesheet'
      link.href = CSS_URL
      link.integrity = CSS_SRI
      link.crossOrigin = ''
      document.head.appendChild(link)
    }
    // JS
    const existing = document.querySelector(`script[src="${JS_URL}"]`)
    if (existing) {
      existing.addEventListener('load', () => resolve(window.L))
      existing.addEventListener('error', fail)
      if (window.L) resolve(window.L)
      return
    }
    const script = document.createElement('script')
    script.src = JS_URL
    script.integrity = JS_SRI
    script.crossOrigin = ''
    script.async = true
    script.onload = () => resolve(window.L)
    script.onerror = () => { script.remove(); fail() }
    document.body.appendChild(script)
  })
  return leafletPromise
}
