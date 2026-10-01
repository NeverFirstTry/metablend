// The home-screen widgets' data (pure — unit tested): the app's forecast,
// outlook and summit forecast boiled down to display-ready text in the
// phone's language and unit, so the Swift and Java widgets only lay it out.
import { t, translateCondition } from './i18n.js'
import { tempFormatter, dayWord } from './outlook/text.js'
import { addDays, formatCalendarDate } from './localtime.js'
import { skyFor, SKIES, isDark, nightIcon } from './sky.js'
import { conditionIcon, heroCondition } from './conditions.js'
import { parsePeakQuery } from './hike/params.js'
import { pickLang, pickUnit } from './share.js'

const DATE = /^\d{4}-\d{2}-\d{2}$/
const hhmm = iso => iso.slice(11, 16)
const pct = v => (v == null ? '–' : `${Math.round(v)}%`)
const palettes = keys => Object.fromEntries([...new Set(keys)].map(k => [k, SKIES[k] ?? SKIES.night]))
const STORM_KEY = { low: 'stormLow', moderate: 'stormModerate', high: 'stormHigh' }
// City time now, from the real clock: the outlook may come from a CDN copy
// up to an hour and a half old, and past midnight "today" has moved on.
const cityNow = (now, offsetSec, fallback) => (offsetSec == null ? fallback : new Date(now + offsetSec * 1000).toISOString().slice(0, 16))
const kmh = v => (v == null ? '–' : `${Math.round(v)} km/h`)

export function parseAppWidgetQuery(sp) {
  const lang = pickLang(sp.get('lang')), unit = pickUnit(sp.get('unit'))
  if (sp.get('kind') === 'hike') {
    const peak = parsePeakQuery(sp), date = sp.get('date') ?? ''
    return peak && DATE.test(date) ? { kind: 'hike', peak, date, lang, unit } : null
  }
  const city = (sp.get('city') ?? '').trim()
  return city && city.length <= 100 ? { kind: 'weather', city, lang, unit } : null
}

export function weatherPayload({ forecast, outlook, lang, unit, now = Date.now() }) {
  const fmt = tempFormatter(unit)
  const sun = outlook.sun ?? null
  const nowLocal = cityNow(now, outlook.utcOffsetSec, outlook.nowLocal), todayLocal = nowLocal.slice(0, 10)
  const hourly = outlook.hourly ?? []
  const current = hourly.find(h => h.t.slice(0, 13) === nowLocal.slice(0, 13)) ?? hourly[0]
  const condition = heroCondition(forecast)
  const nowSky = skyFor({ code: current?.code ?? null, nowLocal, sun })
  const epoch = local => Date.parse(`${local}:00Z`) / 1000 - (outlook.utcOffsetSec ?? 0)
  const hours = hourly.filter(h => h.t > nowLocal).slice(0, 6).map(h => ({
    t: hhmm(h.t), ts: epoch(h.t),
    icon: (isDark(hhmm(h.t), sun) ? nightIcon(h.icon) : h.icon) ?? '',
    temp: fmt(h.temp), rain: pct(h.rainPct),
    sky: skyFor({ code: h.code ?? null, nowLocal: h.t, sun }),
  }))
  const today = (outlook.days ?? []).find(d => d.date === todayLocal)
  const days = (outlook.days ?? []).filter(d => d.date > todayLocal).slice(0, 5).map(d => ({
    day: formatCalendarDate(d.date, lang, { weekday: 'short' }), icon: d.icon ?? '', hi: fmt(d.tempMax), lo: fmt(d.tempMin),
  }))
  return {
    kind: 'weather', city: forecast.city, path: `/?city=${encodeURIComponent(forecast.city)}`,
    now: {
      temp: fmt(forecast.consensus?.temp),
      icon: conditionIcon(condition, forecast.lon, isDark(hhmm(nowLocal), sun)),
      text: translateCondition(lang, condition ?? ''),
      sky: nowSky,
      detail: `💧 ${pct(current?.rainPct)} · 💨 ${kmh(forecast.consensus?.windKmh)}`,
    },
    today: { hi: fmt(today?.tempMax), lo: fmt(today?.tempMin) },
    hours, days,
    skies: palettes([nowSky, ...hours.map(h => h.sky)]),
  }
}

export function skyForIcon(icon) {
  if (icon === '⛈') return 'storm'
  if (icon === '🌧' || icon === '🌦') return 'rain'
  if (icon === '🌨') return 'snow'
  if (icon === '☁️' || icon === '🌫') return 'cloudy'
  return 'day'
}

const hikePath = p => `/hike?lat=${p.lat}&lon=${p.lon}&elev=${Math.round(p.elev)}&name=${encodeURIComponent(p.name ?? '')}`

// The window only exists for today and tomorrow at the peak; later days get
// the day summary and no verdict (line/good null). A window whose storm risk
// is unknown is never green — same rule as the hike page.
export function hikePayload({ hike, peak, date, lang, unit, now = Date.now() }) {
  const day = (hike.days ?? []).find(d => d.date === date)
  if (!day) return null
  const fmt = tempFormatter(unit)
  const todayLocal = cityNow(now, hike.utcOffsetSec, hike.nowLocal).slice(0, 10)
  const slot = date === todayLocal ? hike.windows?.today : date === addDays(todayLocal, 1) ? hike.windows?.tomorrow : undefined
  const stormUnknown = !!hike.notes?.includes('no_storm_data')
  const word = dayWord(lang, date, todayLocal)
  const sky = skyForIcon(day.icon)
  return {
    kind: 'hike', peak: peak.name ?? '', day: word.charAt(0).toLocaleUpperCase(lang) + word.slice(1), path: hikePath(peak),
    line: slot === undefined ? null : !slot ? t(lang, 'swNoDaylight') : slot.window ? `${hhmm(slot.window.from)}–${hhmm(slot.window.to)}` : t(lang, 'widgetNoWindow'),
    good: slot === undefined ? null : !!slot?.window && !stormUnknown,
    icon: day.icon ?? '', hi: fmt(day.tempMax), lo: fmt(day.tempMin),
    wind: kmh(day.windMax), rain: pct(day.rainPct),
    storm: day.storm ? `${t(lang, 'stormRisk')}: ${t(lang, STORM_KEY[day.storm] ?? 'stormLow')}` : null,
    sky, skies: palettes([sky]),
  }
}
