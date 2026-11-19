// The summit pages' forecast (app/mountains/[peak]/page.js). The answer is kept as long as the page itself
// (STORED_SECONDS, six hours): a page is rebuilt at the shortest time among its own requests, and while this
// one said 30 minutes the pages were rebuilt every 30 minutes whatever their own setting said (seen on the
// served header on 2026-11-17; on 18 November nine in ten requests rebuilt their page, each one Open-Meteo
// request). Next's fetch cache keeps every 200 answer for that time, and /api/hike sends "unavailable" with
// 200 (so the app's peak view shows its retry card): one kept after a bad moment failed the page for as long
// (2026-11-10, Großglockner). So an unavailable answer is asked once more under a key of its own, which no
// kept answer can stand in for.
// shortcut: a page built during an Open-Meteo outage from the peak's last good answer (it is marked with its
// time) is kept six hours like any other; give such a build a shorter time if outages become common.
import { STORED_SECONDS } from './summit-props.js'

export async function loadSummit(url, get = fetch) {
  let failure = 'unavailable'
  for (const u of [url, `${url}&fresh=${Date.now()}`]) {
    const res = await get(u, { next: { revalidate: STORED_SECONDS } })
    const body = res.ok ? await res.json() : null
    if (body && !body.unavailable) return body
    failure = res.ok ? 'unavailable' : res.status
  }
  throw new Error(`hike api ${failure}`) // 500 → crawlers retry instead of dropping the page, and no empty page is kept
}
