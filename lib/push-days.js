// The day chips for "Plan a hike" (pure — unit tested): tomorrow … +7 in the
// peak's own calendar, named like the rest of the app ("Tomorrow", "Fri").
// No "today": the alerts come at 18:00 the day before or 06:00 on the day.
import { dayWord } from './outlook/text.js'
import { addDays } from './localtime.js'

export function planDays(lang, todayLocal) {
  return Array.from({ length: 7 }, (_, i) => {
    const date = addDays(todayLocal, i + 1)
    const word = dayWord(lang, date, todayLocal)
    return { date, label: word.charAt(0).toLocaleUpperCase(lang) + word.slice(1) } // a chip, not mid-sentence
  })
}
