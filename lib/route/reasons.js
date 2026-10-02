// Why a stage or a day isn't walkable, as i18n keys: the summit engine's
// reasons plus the route-only ones.
import { REASON } from '../hike/text.js'

export const REASON_KEY = { ...REASON, daylight: 'routeReasonDaylight', nodata: 'routeReasonNodata' }
