import { isNightAt } from '@/lib/localtime'

// Consensus condition → icon. Sources report English condition strings;
// night only swaps the clear-sky icon, judged by the city's clock.
export function conditionIcon(condition, lon) {
  const c = (condition ?? '').toLowerCase()
  if (/thunder|storm/.test(c)) return '⛈'
  if (/snow|sleet|ice|freez/.test(c)) return '🌨'
  if (/drizzle/.test(c)) return '🌦'
  if (/rain|shower/.test(c)) return '🌧'
  if (/fog|mist|haze/.test(c)) return '🌫'
  if (/overcast/.test(c)) return '☁️'
  if (/partly|broken|scattered|few/.test(c)) return '⛅'
  if (/cloud/.test(c)) return '☁️'
  if (/clear|sunny|fair/.test(c)) return isNightAt(lon) ? '🌙' : '☀️'
  return '🌤'
}

// Open-Meteo's wording when it's up, otherwise the first healthy source.
export function heroCondition(data) {
  return data?.sources?.find(s => s.apiId === 'open-meteo' && !s.down)?.condition
    ?? data?.sources?.find(s => !s.down && s.condition)?.condition
    ?? null
}
