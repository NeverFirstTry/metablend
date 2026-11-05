// The blend itself (pure, unit tested): the sources that answered and their
// saved weights go in, the consensus and the warning come out.
export function blendNow(results, weightRows) {
  const weightMap = {}
  weightRows.forEach(w => { weightMap[w.id] = w.weight })
  // a source never scored here counts like an average one (saved weights add up to 1)
  const unscored = weightRows.length ? 1 / weightRows.length : 1

  // Rain is averaged only across sources reporting a true precipitation
  // probability (rainIsProb) — cloud cover / humidity stand-ins used to bias
  // the answer toward "rain". MET Norway/GeoSphere pseudo-probabilities serve as a
  // fallback when no real probability source responded.
  let totalWeight = 0
  let wTemp = 0, wFeelsLike = 0, wWind = 0
  let rainSum = 0, rainWeight = 0

  results.forEach(r => {
    const w = weightMap[r.apiId] ?? unscored
    wTemp      += r.temp                   * w
    wFeelsLike += (r.feelsLike ?? r.temp)  * w
    wWind      += r.windKmh                * w
    totalWeight += w
    if (r.rainIsProb && r.rainPct != null) { rainSum += r.rainPct * w; rainWeight += w }
  })
  if (!rainWeight) {
    results.forEach(r => {
      if (r.rainPct == null) return
      const w = weightMap[r.apiId] ?? unscored
      rainSum += r.rainPct * w; rainWeight += w
    })
  }

  const consensus = {
    temp:      Math.round((wTemp      / totalWeight) * 10) / 10,
    feelsLike: Math.round((wFeelsLike / totalWeight) * 10) / 10,
    rainPct:   rainWeight ? Math.round(rainSum / rainWeight) : null,
    windKmh:   Math.round( wWind      / totalWeight),
  }

  const temps = results.map(r => r.temp)
  const std = Math.sqrt(temps.reduce((s, t) => s + (t - consensus.temp) ** 2, 0) / temps.length)
  consensus.confidencePct = Math.max(0, Math.min(100, Math.round(100 - std * 12)))

  // warn only when everyone agrees it's nasty — judged on real rain
  // probabilities only, so a humid overcast day can't trip the alarm
  const STORM = /thunder|storm|gewitter|orage|tormenta|temporale/i
  const probSources = results.filter(r => r.rainIsProb && r.rainPct != null)
  const allHeavyRain = probSources.length >= 2 && probSources.every(r => r.rainPct > 80)
  const allStorm = results.length >= 2 && results.every(r => STORM.test(r.condition ?? ''))
  const warning = (allHeavyRain || allStorm)
    ? { active: true, type: allStorm ? 'thunderstorm' : 'heavy_rain' }
    : { active: false }

  // Sources without a probability feed still say things: an explicit rain /
  // snow / thunder condition is an observation, not the cloud-cover stand-in
  // that rainIsProb guards against. Their share works as an ensemble vote
  // that floors the probability — "3 sources report rain" must never
  // coexist with a single-digit rain number. null stays reserved for "no
  // rain data at all". (The rain *verdict* for the hours ahead is the
  // outlook's 48 h headline now.)
  const PRECIP = /rain|drizzle|shower|sleet|snow|hail|thunder|storm/i
  const reporting = results.filter(r => r.condition)
  const rainingNow = reporting.filter(r => PRECIP.test(r.condition))
  if (reporting.length >= 3 && rainingNow.length) {
    const vote = Math.round((rainingNow.length / reporting.length) * 100)
    if (consensus.rainPct == null || vote > consensus.rainPct) consensus.rainPct = vote
  }

  return { consensus, warning, weights: weightMap, rainingNow: { count: rainingNow.length, total: reporting.length } }
}
