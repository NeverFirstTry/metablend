// The summit pages' forecast (app/mountains/[peak]/page.js). The answer is kept as long as the page itself
// (STORED_SECONDS, six hours): a page is rebuilt at the shortest time among its own requests, and while this
// one said 30 minutes the pages were rebuilt every 30 minutes whatever their own setting said (seen on the
// served header on 2026-11-17; on 18 November nine in ten requests rebuilt their page, each one Open-Meteo
// request). Next's fetch cache keeps every 200 answer for that time, and /api/hike sends "unavailable" with
// 200 (so the app's peak view shows its retry card): one kept after a bad moment failed the page for as long
// (2026-11-10, Großglockner). So an unavailable answer is asked once more under a key of its own, which no
// kept answer can stand in for.
// The six hours are for normal pages only (owner, 2026-11-20). During an Open-Meteo outage the route answers
// with the peak's last good answer, marked `kept` (lib/last-answer.js). A page's time cannot be set after
// its requests are in, so the same address is asked once more under KEPT_SECONDS: the shortest time wins,
// and the page is built again 30 minutes later. That second answer is the one used. On the first such build
// it is the copy just fetched (no new request, seen on a local build); on the builds after it the six-hour
// copy still holds the old answer and only this request, 30 minutes on, reaches the route again.
import { STORED_SECONDS, KEPT_SECONDS } from './summit-props.js'

const ask = async (get, u, seconds) => {
  const res = await get(u, { next: { revalidate: seconds } })
  return { ok: res.ok, status: res.status, body: res.ok ? await res.json() : null }
}
const usable = body => body && !body.unavailable

export async function loadSummit(url, get = fetch) {
  let failure = 'unavailable'
  for (const u of [url, `${url}&fresh=${Date.now()}`]) {
    const { ok, status, body } = await ask(get, u, STORED_SECONDS)
    if (usable(body)) {
      if (!body.kept) return body
      const again = (await ask(get, u, KEPT_SECONDS).catch(() => ({}))).body
      return usable(again) ? again : body
    }
    failure = ok ? 'unavailable' : status
  }
  throw new Error(`hike api ${failure}`) // 500 → crawlers retry instead of dropping the page, and no empty page is kept
}
