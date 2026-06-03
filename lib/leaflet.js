// Pull Leaflet off the CDN once and hand back the global `L`. Keeping it out
// of the bundle dodges the whole "window is not defined" SSR mess.
const LEAFLET_VERSION = '1.9.4'
const CSS_URL = `https://unpkg.com/leaflet@${LEAFLET_VERSION}/dist/leaflet.css`
const JS_URL = `https://unpkg.com/leaflet@${LEAFLET_VERSION}/dist/leaflet.js`

let leafletPromise = null

export function loadLeaflet() {
  if (typeof window === 'undefined') return Promise.resolve(null)
  if (window.L) return Promise.resolve(window.L)
  if (leafletPromise) return leafletPromise

  leafletPromise = new Promise((resolve, reject) => {
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
      existing.addEventListener('error', reject)
      if (window.L) resolve(window.L)
      return
    }
    const script = document.createElement('script')
    script.src = JS_URL
    script.async = true
    script.onload = () => resolve(window.L)
    script.onerror = reject
    document.body.appendChild(script)
  })
  return leafletPromise
}
