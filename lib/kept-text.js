// "Stand: 12. Nov., 13:31" for an answer kept from before an outage: lib/last-answer.js marks such an
// answer with `kept`, the time it was made. Shown in the place's own time, in the words the summit
// pages already use for their stored forecast.
import { t } from './i18n.js'
import { fill } from './outlook/text.js'
import { madeAtText } from './hike/summit-props.js'

export const keptAsOf = (kept, utcOffsetSec, lang) =>
  fill(t(lang, 'mtnAsOf'), { when: madeAtText(new Date(Date.parse(kept) + (utcOffsetSec ?? 0) * 1000).toISOString().slice(0, 16), lang) })
