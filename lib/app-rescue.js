// The website's hiking teaser reached the app (app/hike/AppRescue.jsx; pure —
// unit tested). First a soft refresh: the boot script has set the app cookie
// by now. If the teaser is still there — or comes back later in the same run —
// a full load with ?app=1, which the server always answers with the app view.
// With ?app=1 already there, nothing is tried again: no loop.
export function rescueStep(href, softTried) {
  const url = new URL(href)
  if (url.searchParams.get('app') === '1') return { action: 'stop' }
  if (!softTried) return { action: 'refresh' }
  url.searchParams.set('app', '1')
  return { action: 'reload', to: url.pathname + url.search + url.hash }
}
