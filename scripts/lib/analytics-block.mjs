// The capture scripts (phone layout check, accessibility check, store screenshots) are no visitors: they
// block the site's analytics (Plausible, Vercel Web Analytics and Speed Insights, app/components/SiteAnalytics.jsx)
// in the browser and count what was blocked and what still reached its service.
export const ANALYTICS = ['*plausible.io/*', '*/_vercel/insights/*', '*/_vercel/speed-insights/*', '*va.vercel-scripts.com/*', '*vitals.vercel-insights.com/*']
export const IS_ANALYTICS = /plausible\.io\/|\/_vercel\/(speed-)?insights\/|va\.vercel-scripts\.com|vitals\.vercel-insights\.com/

// after Network.enable on the DevTools socket; the returned tally fills as pages load
export async function blockAnalytics(ws, send) {
  const tally = { blocked: 0, sent: 0 }
  ws.addEventListener('message', e => {
    const m = JSON.parse(e.data)
    if (m.method === 'Network.loadingFailed' && m.params.blockedReason === 'inspector') tally.blocked++
    if (m.method === 'Network.responseReceived' && IS_ANALYTICS.test(m.params.response.url)) tally.sent++
  })
  await send('Network.setBlockedURLs', { urls: ANALYTICS })
  return tally
}

// a finding when anything got through
export const analyticsLeak = tally => tally.sent ? `analytics: ${tally.sent} requests reached Plausible or Vercel; the run would count as visits` : null
