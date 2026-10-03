// Notification texts (pure — unit tested): one message as { title, body } in
// the device's language and unit. The briefing reuses the page headlines'
// sentence builder, hike alerts the summit-window one, so the app and its
// notifications always say the same thing.
import { t } from '../i18n.js'
import { fill, tempFormatter, headlineText, dayPhrase } from '../outlook/text.js'
import { REASON_KEY } from '../route/reasons.js'
import { windowText } from '../hike/text.js'
import { nowcastPushBody } from '../nowcast-text.js'

const hh = iso => iso.slice(11, 16)
const SEVERE_KEY = { heavy_rain: 'pushHeavyRain', heavy_snow: 'pushHeavySnow', freezing_rain: 'pushFreezingRain', wind: 'pushStrongWind' }

export function pushText(lang, unit, msg) {
  const tr = (key, vars = {}) => fill(t(lang, key), vars)
  const fmt = tempFormatter(unit)
  const v = msg?.vars ?? {}
  switch (msg?.kind) {
    case 'rain':
      return { title: tr('pushRainTitle', { city: v.city }), body: v.nowcast ? nowcastPushBody(lang, v) : tr('pushRainBody', { from: hh(v.from), pct: v.pct }) }
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
    case 'hike_route_evening':
    case 'hike_route_morning': {
      const s = v.suggestion ?? {}
      const body = s.none
        ? tr('pushRouteNone', { day: dayPhrase(lang, v.date, v.todayLocal), reason: t(lang, REASON_KEY[s.reason] ?? 'routeReasonNodata') })
        : tr('pushRouteStart', { start: s.start, high: s.highAt, latest: s.latest })
      return { title: tr('pushHikeTitle', { peak: v.peak }), body }
    }
    case 'test':
      return { title: 'MetaBlend', body: t(lang, 'pushTestBody') }
    default:
      return null
  }
}
