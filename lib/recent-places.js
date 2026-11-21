// The start page's recent places (a cookie of names): one place once. Names are compared without accents,
// case or outer spaces, so a town searched as "Buôn Ma Thuột" and as "Buon Ma Thuot" stands once (tester,
// 2026-11-19); a list written before keeps its doubles in the cookie and loses them when read. The newest
// spelling stays. The fold is lib/weather.js placeKey's, not imported: that file brings the server's
// Open-Meteo gate into the browser. Letters that do not come apart into a letter and a mark (đ, ł, ø, ß)
// count as their plain letter too: "Łódź" and "Lodz" (Fable's review, 2026-11-20).
// shortcut: one town in two languages ("Wien", "Vienna") still stands twice; that needs the place's position
// stored with its name (UX review 2026-11-20, R1, second step).
const PLAIN = { đ: 'd', ł: 'l', ø: 'o', ß: 'ss' }
const fold = s => s.normalize('NFD').replace(/\p{M}/gu, '').trim().toLowerCase().replace(/[đłøß]/g, c => PLAIN[c])
export const samePlace = (a, b) => fold(a) === fold(b)
export const uniquePlaces = list => (Array.isArray(list) ? list : [])
  .filter(c => typeof c === 'string')
  .filter((c, i, all) => all.findIndex(d => samePlace(d, c)) === i)

// The search area's one row of places (UX review R2): saved places first, then the recent ones not saved, each
// place once however it is spelt.
export function placeChips(saved, recent) {
  const s = uniquePlaces(saved)
  return [...s.map(city => ({ city, saved: true })), ...uniquePlaces(recent).filter(c => !s.some(x => samePlace(x, c))).map(city => ({ city, saved: false }))]
}
