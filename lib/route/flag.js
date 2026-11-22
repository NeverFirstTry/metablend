// A route stage past the favourable limit says why (UX review 2026-11-20, O3): the row was tinted and said
// "rain" under a sun-behind-cloud icon with 30 % rain, three stories at once. Rain now says its chance and
// shows the rain icon; another reason keeps its word and the hour's icon.
import { t } from '../i18n.js'
import { fill } from '../outlook/text.js'
import { REASON_KEY } from './reasons.js'

export function stageFlag(lang, st) {
  if (!st?.blocker) return null
  if (st.blocker === 'rain') return { text: typeof st.rain === 'number' ? fill(t(lang, 'routeRainPossible'), { pct: st.rain }) : t(lang, REASON_KEY.rain), icon: '🌧' }
  return { text: t(lang, REASON_KEY[st.blocker]), icon: st.icon }
}
