// The summit pages' forecast (app/mountains/[peak]/page.js). Next's fetch cache keeps every 200 answer
// for its 30 minutes, and /api/hike sends "unavailable" with 200 (so the app's peak view shows its retry
// card): one kept after a bad moment failed the page for all 30 minutes (2026-11-10, Großglockner).
// So an unavailable answer is asked once more under a key of its own, which no kept answer can stand in for.
export async function loadSummit(url, get = fetch) {
  let failure = 'unavailable'
  for (const u of [url, `${url}&fresh=${Date.now()}`]) {
    const res = await get(u, { next: { revalidate: 1800 } })
    const body = res.ok ? await res.json() : null
    if (body && !body.unavailable) return body
    failure = res.ok ? 'unavailable' : res.status
  }
  throw new Error(`hike api ${failure}`) // 500 → crawlers retry instead of dropping the page, and no empty page is kept
}
