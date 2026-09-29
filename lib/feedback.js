// Input validation for community feedback reports (/api/feedback). Pure, so
// `node --test` covers it without a database.
//
// Everything the server can derive itself — report date, region, the pin's
// coordinates — is NOT taken from the client: those used to decide which day
// a report counted for (a '__calibrate__' report dated yesterday switched off
// the daily calibration), which weight bucket moved, and where a heatmap pin
// landed.

// The feedback form's condition keys (lib/i18n.js getWeatherOptions), plus the
// German values the form sent before the i18n keys existed.
const CONDITIONS = new Set([
  'sunny', 'clear', 'partlyCloudy', 'cloudy', 'overcast', 'rain', 'thunder', 'snow',
  'Sonnig', 'Klar', 'Leicht bewölkt', 'Bewölkt', 'Bedeckt', 'Regen', 'Gewitter', 'Schnee',
])

const MAX_CITY_LEN = 100

const fail = (status, error) => ({ ok: false, status, error })

// Coordinates are only a hint (the city-local date and night check); anything
// that isn't a plausible number degrades to null instead of failing the report.
const coord = (v, max) => (typeof v === 'number' && Number.isFinite(v) && Math.abs(v) <= max ? v : null)

// → { ok: true, value: { city, actualTemp, actualCond, lat, lon } }
// → { ok: false, status, error }
export function parseFeedback(body) {
  if (!body || typeof body !== 'object') return fail(400, 'Invalid request body.')
  const { city, actualTemp, actualCond, lat, lon } = body

  if (!city || actualTemp == null || !actualCond) return fail(400, 'Missing fields')

  const name = typeof city === 'string' ? city.trim() : ''
  if (!name || name.length > MAX_CITY_LEN) return fail(400, 'Invalid city.')

  // typeof, not a range check alone: NaN fails every comparison, so a string
  // temperature used to sail through and score every source −2
  if (typeof actualTemp !== 'number' || !Number.isFinite(actualTemp)) {
    return fail(400, 'Temperature must be a number.')
  }
  if (actualTemp < -50 || actualTemp > 60) {
    return fail(422, `Temperature ${actualTemp}°C is outside the valid range (−50 to +60°C).`)
  }

  if (!CONDITIONS.has(actualCond)) return fail(400, 'Unknown weather condition.')

  return { ok: true, value: { city: name, actualTemp, actualCond, lat: coord(lat, 90), lon: coord(lon, 180) } }
}
