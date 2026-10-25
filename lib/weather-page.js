// What the city page (/weather/[city]) makes of /api/forecast's answer. The
// page is cached (ISR): a returned 'unknown' becomes a 404 page that stays
// cached, a thrown error keeps the last good page (a first visit gets a 500,
// which crawlers retry). The API says "not found" whenever the geocoder gives
// nothing back — also when it just failed — so for one of our own cities that
// can only be a failure, never a reason to cache a 404.
export async function readForecast(res, ourCity) {
  const notFound = () => {
    if (ourCity) throw new Error('forecast api: a listed city not found (geocoder failing?)')
    return 'unknown'
  }
  if (res.status === 404) return notFound()
  if (!res.ok) throw new Error(`forecast api ${res.status}`)
  const json = await res.json()
  return json.error ? notFound() : json
}
