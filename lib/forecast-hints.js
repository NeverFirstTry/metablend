// Small rules behind the forecast page's hints and chart (pure — unit tested).

// "6 of 19 sources report rain right now" only when most of them do: a minority next to
// "dry today" read as a contradiction.
export const showRainNow = r => !!r && r.count > 0 && r.count * 2 >= r.total

// hour labels on the chart: every hour when few are left (an evening), every 3 or 6 otherwise
export const tickEvery = n => (n > 30 ? 6 : n > 8 ? 3 : 1)

// rain bars stay narrow however few hours there are, and a chance under 10% draws nothing
export const rainBarWidth = (width, n) => Math.min(12, Math.max(2, width / Math.max(1, n) - 1.5))
export const MIN_RAIN_BAR = 10
