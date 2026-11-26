// A route stage past the favourable limit says why (UX review 2026-11-20, O3): the row was tinted and said
// "rain" under a sun-behind-cloud icon with 30 % rain, three stories at once. Rain now says its chance and
// shows the rain icon; another reason keeps its word and the hour's icon.
import { t } from '../i18n.js'
import { fill } from '../outlook/text.js'
import { REASON_KEY } from './reasons.js'
import { reasonKey } from '../hike/text.js'
import { precipKind } from '../hike/physics.js'

// "possible, 60%" for what falls at the stage's height
const POSSIBLE = { rain: 'routeRainPossible', snow: 'routeSnowPossible', mixed: 'routeMixedPossible' }

export function stageFlag(lang, st) {
  if (!st?.blocker) return null
  if (st.blocker === 'rain') {
    const kind = precipKind(st.temp)
    return { text: typeof st.rain === 'number' ? fill(t(lang, POSSIBLE[kind]), { pct: st.rain }) : t(lang, reasonKey('rain', kind, REASON_KEY)), icon: kind === 'snow' ? '🌨' : '🌧' }
  }
  return { text: t(lang, REASON_KEY[st.blocker]), icon: st.icon }
}
