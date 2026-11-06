// The significant-weather labels from lib/metar.js in the visitor's language. Those
// labels stay English because they are also compared with each other (lib/metar.js
// tafDivergence); this only translates what is shown.
import { t } from './i18n.js'
import { fill } from './outlook/text.js'

const KEYS = {
  Thunderstorm: 'wxThunderstorm',
  'Funnel cloud': 'wxFunnel',
  'Tornado / waterspout': 'wxTornado',
  Hail: 'wxHail',
  'Freezing rain': 'wxFreezingRain',
  'Freezing drizzle': 'wxFreezingDrizzle',
  Squall: 'wxSquall',
  'Volcanic ash': 'wxVolcanicAsh',
  Sandstorm: 'wxSandstorm',
  Duststorm: 'wxDuststorm',
  'Small hail / snow pellets': 'wxSmallHail',
  'Ice pellets': 'wxIcePellets',
  'Freezing fog': 'wxFreezingFog',
  'Blowing snow': 'wxBlowingSnow',
}
const NEAR = ' (vicinity)'

export function wxText(lang, label) {
  if (label.startsWith('Windshear')) return label.replace('Windshear', t(lang, 'wxWindshear'))
  const near = label.endsWith(NEAR)
  let base = near ? label.slice(0, -NEAR.length) : label
  const heavy = base.startsWith('Heavy ')
  if (heavy) base = base[6].toUpperCase() + base.slice(7)
  if (!KEYS[base]) return label // never a guess: an unknown label stays as it came
  let text = t(lang, KEYS[base])
  if (heavy) text = fill(t(lang, 'wxHeavy'), { wx: text })
  return near ? fill(t(lang, 'wxNear'), { wx: text }) : text
}
