// What the sources say about the temperature, in one sentence (pure, unit tested).
import { t } from './i18n.js'
import { fill } from './outlook/text.js'

// the same limits as the colour of "% agree" in the hero
const AGREE_HIGH = 70, AGREE_MID = 45
export const agreeColor = pct => (pct >= AGREE_HIGH ? 'var(--ok)' : pct >= AGREE_MID ? 'var(--warn)' : 'var(--bad)')
// below this many sources the sentence says how few and claims nothing about reliability
const FEW = 5

export const liveSources = sources => (sources ?? []).filter(s => !s.down && !s.synthetic && typeof s.temp === 'number')

export function spreadSummary(sources) {
  const temps = liveSources(sources).map(s => s.temp).sort((a, b) => a - b)
  if (!temps.length) return null
  // "most of them": the narrowest run holding two thirds of the sources
  const need = Math.ceil((temps.length * 2) / 3)
  let start = 0
  for (let i = 1; i + need <= temps.length; i++) {
    if (temps[i + need - 1] - temps[i] < temps[start + need - 1] - temps[start]) start = i
  }
  return { count: temps.length, min: temps[0], max: temps.at(-1), coreLow: temps[start], coreHigh: temps[start + need - 1] }
}

// How far a source sits from the blend. A clear outlier is 5 °C or more off.
export function sourceDeviation(tempC, consensusC, unit = 'C') {
  const off = tempC - consensusC
  const shown = Math.round(unit === 'F' ? off * 9 / 5 : off)
  return {
    text: shown === 0 ? '0°' : `${shown > 0 ? '+' : '−'}${Math.abs(shown)}°`,
    outlier: Math.round(Math.abs(off) * 10) / 10 >= 5,
  }
}

// Whole degrees like the hero's numeral, with a real minus sign.
export function spreadSentence(lang, sources, fmtTemp, agreePct) {
  const s = spreadSummary(sources)
  if (!s) return null
  if (s.count === 1) return t(lang, 'spreadOne')
  const deg = v => fmtTemp(v).replace('-', '−')
  const range = (a, b) => {
    const lo = deg(a), hi = deg(b)
    if (lo === hi) return lo
    const bare = lo.replace('°', '')
    return `${bare}${bare.startsWith('−') ? ' - ' : '-'}${hi}`
  }
  // every blended source counts, also one whose readings a licence keeps private; the range is from those shown
  const n = (sources ?? []).filter(x => !x.down && !x.synthetic).length
  const say = (key, core = range(s.coreLow, s.coreHigh)) => fill(t(lang, key), { n, min: deg(s.min), max: deg(s.max), core })
  const wide = s.max - s.min
  if (n < FEW) return wide <= 2 ? say('spreadFewAgree', range(s.min, s.max)) : say('spreadFewRange')
  if (wide <= 1) return say('spreadAll', range(s.min, s.max))
  if (agreePct < AGREE_MID) return say('spreadLow')
  return say(agreePct < AGREE_HIGH ? 'spreadMid' : 'spreadHigh')
}
