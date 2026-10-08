// The 15-minute refresh (deps injected — unit tested with fakes): each
// country's feed → parseFeed → save. A feed that fails leaves that country's
// stored warnings alone (they expire on their own); the others still refresh.
import { parseFeed } from './parse.js'

export async function refreshAll({ feeds, fetchFeed, save, now = Date.now(), concurrency = 6 }) {
  const done = [], failed = []
  let next = 0
  async function worker() {
    while (next < feeds.length) {
      const [slug, country] = feeds[next++]
      try {
        const json = await fetchFeed(slug)
        if (!json) throw new Error('no answer')
        if (!Array.isArray(json.warnings)) throw new Error('not a feed') // e.g. a maintenance page
        const rows = parseFeed(json, country, now)
        await save(country, rows, now)
        done.push([country, rows.length])
      } catch (e) {
        failed.push([country, String(e?.message ?? e)])
      }
    }
  }
  await Promise.all(Array.from({ length: Math.min(concurrency, feeds.length) }, worker))
  return { countries: done.length, warnings: done.reduce((s, [, n]) => s + n, 0), failed }
}
