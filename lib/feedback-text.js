// What the feedback panel says after a send, as an i18n key (owner, 2026-11-22: it showed the feedback route's
// English texts raw). Keyed by the route's status and what was sent; the route and its texts stay as they are.
// sunnyAtNight: "sunny" was sent while it is night at the place (lib/localtime.js isNightAt, the route's own check,
// made before its check of the temperature), which tells the route's two 422 answers apart.
export function feedbackResultKey(r) {
  if (!r) return 'fbErrSend' // no answer at all: offline, or the request failed
  const { status, json, sunnyAtNight = false } = r
  if (status >= 200 && status < 300 && !json?.error) return json?.weights ? 'fbThanksWeights' : 'fbThanks'
  if (status === 429) return 'fbErrHour'
  if (status === 422) return sunnyAtNight ? 'fbErrNightSun' : 'fbErrFar'
  if (status === 400) return 'fbErrCheck'
  return 'fbErrSend'
}
