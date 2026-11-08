// Sources whose terms cap how long their current conditions may be kept:
// WeatherAPI.com allows 60 minutes. Their forecast rows are scored by the
// hourly station calibration and deleted at the end of that run, so none
// lives past the next run; the daily scoring jobs no longer see them.
export const SHORT_LIVED = ['weatherapi']

// `before`: the run's start (ISO) — rows written during the run wait for the next one.
export async function purgeShortLived(db, before) {
  const { error } = await db.from('forecasts').delete().in('api_id', SHORT_LIVED).lt('created_at', before)
  if (error) throw new Error(`purge short-lived forecasts: ${error.message}`)
}
