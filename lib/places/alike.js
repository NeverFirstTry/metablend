// When may a town be offered although none of its names begins with what was typed? The database's
// look-alikes come from a fuzzy match over every name and spelling a town has, inner words included:
// "Inns" brought Kreith (filed with "Innsbruck" in a second name), Augsburg and Vinzons before Innisfil
// (2026-11-14). A reader sees one name and cannot follow that. So a look-alike is offered only when a
// name the reader can see explains it:
//   - a later word of the name begins with the text ("Wasserburg am Inn" for "inn"), or
//   - from six letters on, the name holds the text ("Heiligenblut am Großglockner" for "glockner"; the
//     summits follow the same rule, app/api/places/search/route.js), or
//   - from five letters on, the name begins with the text but for one slip of the finger: one letter
//     wrong, missing, too many, or two swapped ("insbr", "innbsr" for Innsbruck). The first letter counts
//     as right, and four letters are too few: one of four wrong is a different word ("inns", "inno").
// Pure, both sides already through placeKey (lower case, no accents).

// a and b are the same but for at most one slip
function oneSlip(a, b) {
  if (Math.abs(a.length - b.length) > 1) return false
  let i = 0
  while (i < a.length && i < b.length && a[i] === b[i]) i++
  const x = a.slice(i), y = b.slice(i)
  return x === y || x.slice(1) === y.slice(1) || x.slice(1) === y || x === y.slice(1)
    || (x.length > 1 && y.length > 1 && x[0] === y[1] && x[1] === y[0] && x.slice(2) === y.slice(2))
}

export function looksLike(typed, name) {
  if (!typed || !name) return false
  if (name.split(/[\s\-/(]+/).slice(1).some(w => w.startsWith(typed))) return true
  if (typed.length >= 6 && name.includes(typed)) return true
  if (typed.length < 5 || typed[0] !== name[0]) return false
  return [typed.length - 1, typed.length, typed.length + 1].some(n => n <= name.length && oneSlip(typed, name.slice(0, n)))
}
