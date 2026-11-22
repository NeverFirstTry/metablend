// The rain radar's legend and time (UX review D2). The tiles use RainViewer's colour scheme 2, Universal Blue
// (rainviewer.com/files/rainviewer_api_colors_table.csv, read 2026-11-21): 20 dBZ #00a3e0, 30 dBZ #005588,
// 40 dBZ #ffaa00. Light rain below 30 dBZ, moderate 30 to 40, heavy above: the usual bands.
import { t } from './i18n.js'
import { fill } from './outlook/text.js'

export const radarLegend = lang => [
  { label: t(lang, 'radarLight'), color: '#00a3e0' },
  { label: t(lang, 'radarModerate'), color: '#005588' },
  { label: t(lang, 'radarHeavy'), color: '#ffaa00' },
]

// the picture's time on the reader's clock (`time`: RainViewer's frame, seconds); timeZone only for tests
export function radarTime(lang, time, timeZone = undefined) {
  if (time == null) return null
  const hm = new Date(time * 1000).toLocaleTimeString(lang, { hour: '2-digit', minute: '2-digit', hour12: false, timeZone })
  return fill(t(lang, 'radarAt'), { time: hm })
}
