// The day chips for "Plan a hike" (pure — unit tested): today … +7 in the
// peak's own calendar, named like the rest of the app ("Tomorrow", "Fri").
import { dayWord } from './outlook/text.js'
import { addDays } from './localtime.js'

export function planDays(lang, todayLocal) {
  return Array.from({ length: 8 }, (_, i) => {
    const date = addDays(todayLocal, i)
    const word = dayWord(lang, date, todayLocal)
    return { date, label: word.charAt(0).toLocaleUpperCase(lang) + word.slice(1) } // a chip, not mid-sentence
  })
}
