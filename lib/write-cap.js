// How many uncached forecasts of one address are written to the database in a day. Every forecast our
// server has to build writes about 20 rows (each source's reading, kept two days for the scoring) and one
// for the feed. The database's plan holds 500 MB, and one address asking for a new town 40 times a minute
// could fill what was left in a few hours (code audit, 2026-11-20). Beyond its count an address still gets
// every forecast; only the rows are not written, so the scoring loses nothing a real visitor brings.
// Counted in memory per server copy, like every count by address, and forgotten after a day.
// The site's own readers (the widget feed, the share card, the alert run) ask with the server's key and
// share one larger count: they are set off by public addresses too.
import { createRateLimiter } from './ratelimit.js'

export const STORED_PER_DAY = 100, OWN_PER_DAY = 1000
const DAY = 86_400_000
const byAddress = createRateLimiter({ max: STORED_PER_DAY, windowMs: DAY })
const own = createRateLimiter({ max: OWN_PER_DAY, windowMs: DAY })

// by: who asked, as lib/last-answer.js asker() gives it (an address, an IPv6 line as one, or 'own')
export const mayStore = by => (by === 'own' ? !own.limited('own') : !byAddress.limited(by))
