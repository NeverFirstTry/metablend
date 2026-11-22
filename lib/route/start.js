// Where a marked route starts, for its row in the peak's route list (UX review P2): the height of its first
// point (the route screen's "Start"), and the place where OpenStreetMap names it (the relation's `from`).
// No height, no line: the terrain model fills nearly every route.
import { t } from '../i18n.js'
import { fill } from '../outlook/text.js'

export function routeStart(lang, route) {
  const ele = route?.points?.[0]?.[2]
  if (typeof ele !== 'number') return null
  return route.from
    ? fill(t(lang, 'routeStartPlace'), { place: route.from, ele: Math.round(ele) })
    : fill(t(lang, 'routeStartHeight'), { ele: Math.round(ele) })
}
