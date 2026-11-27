// Small rules behind the forecast page's hints and chart (pure — unit tested).
import { reportedKind } from './precip.js'

// "6 of 19 sources report rain right now" only when most of them do: a minority next to
// "dry today" read as a contradiction.
export const showRainNow = r => !!r && r.count > 0 && r.count * 2 >= r.total

// Which sentence that line says: what the reporting sources report, by the temperature shown beside it
// (lib/precip.js reportedKind). When none of the sources the page is given reports (a licence keeps some
// private) or nothing tells: the neutral sentence, never "rain".
const NOW_HINT = { rain: 'rainNowHint', snow: 'snowNowHint', mixed: 'mixedNowHint' }
export const rainNowKey = data => NOW_HINT[reportedKind(data?.sources, data?.consensus?.temp)] ?? 'precipNowHint'

// hour labels on the chart: every hour when few are left (an evening), every 3 or 6 otherwise
export const tickEvery = n => (n > 30 ? 6 : n > 8 ? 3 : 1)

// rain bars stay narrow however few hours there are, and a chance under 10% draws nothing
export const rainBarWidth = (width, n) => Math.min(12, Math.max(2, width / Math.max(1, n) - 1.5))
export const MIN_RAIN_BAR = 10
