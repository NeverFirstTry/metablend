// Notification texts (pure — unit tested): one message as { title, body } in
// the device's language and unit. The briefing reuses the page headlines'
// sentence builder, hike alerts the summit-window one, so the app and its
// notifications always say the same thing.
import { t } from '../i18n.js'
import { fill, tempFormatter, headlineText } from '../outlook/text.js'
import { windowText } from '../hike/text.js'

const hh = iso => iso.slice(11, 16)
const SEVERE_KEY = { heavy_rain: 'pushHeavyRain', heavy_snow: 'pushHeavySnow', freezing_rain: 'pushFreezingRain', wind: 'pushStrongWind' }

export function pushText(lang, unit, msg) {
  const tr = (key, vars = {}) => fill(t(lang, key), vars)
  const fmt = tempFormatter(unit)
  const v = msg?.vars ?? {}
  switch (msg?.kind) {
    case 'rain':
      return { title: tr('pushRainTitle', { city: v.city }), body: tr('pushRainBody', { from: hh(v.from), pct: v.pct }) }
    case 'storm':
      return { title: tr('pushStormTitle', { city: v.city }), body: tr('pushStormBody', { from: hh(v.from), to: hh(v.to) }) }
    case 'severe':
      return { title: tr('pushSevereTitle', { what: t(lang, SEVERE_KEY[v.what]), city: v.city }), body: tr('pushFromBody', { from: hh(v.from) }) }
    case 'heat':
      return { title: tr('pushHeatTitle', { city: v.city }), body: tr('pushHeatBody', { max: fmt(v.max) }) }
    case 'briefing': {
      const head = headlineText(lang, 'today', v.headline, { todayLocal: v.date, fmtTemp: fmt })?.title ?? null
      const range = `${fmt(v.min).replace('°', '')}–${fmt(v.max)}`
      const best = v.best ? `${t(lang, 'bestTimeOut')} ${hh(v.best)}` : null
      return { title: `${v.heat ? '🌡 ' : ''}${tr('pushBriefTitle', { city: v.city })}`, body: [range, head, best].filter(Boolean).join(' · ') }
    }
    case 'hike_evening':
    case 'hike_morning': {
      const w = windowText(lang, v.window, { date: v.date, todayLocal: v.todayLocal, stormUnknown: v.stormUnknown })
      return { title: tr('pushHikeTitle', { peak: v.peak }), body: [w.title, w.sub].filter(Boolean).join(' · ') }
    }
    case 'test':
      return { title: 'MetaBlend', body: t(lang, 'pushTestBody') }
    default:
      return null
  }
}
