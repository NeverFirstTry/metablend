// Load our own copy of Leaflet once and hand back the global `L`: the published 1.9.4 files in
// public/vendor/leaflet-1.9.4 (lib/leaflet.test.js checks their hashes), so no third party sees a
// visitor open a map. Keeping it out of the bundle dodges the whole "window is not defined" SSR mess.
const BASE = '/vendor/leaflet-1.9.4'
const CSS_URL = `${BASE}/leaflet.css`
const JS_URL = `${BASE}/leaflet.js`

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
    script.async = true
    script.onload = () => resolve(window.L)
    script.onerror = () => { script.remove(); fail() }
    document.body.appendChild(script)
  })
  return leafletPromise
}
