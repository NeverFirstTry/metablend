// Words the store never uses about a forecast. We never promise safety: a window, a start or a
// day is "favourable", not "safe" (the app's own texts are checked in lib/wording.test.js). Store
// captions also make no claim of reliability or accuracy: sources agreeing is not the forecast
// being right. Shared by the tests and scripts/store-shots.mjs, which refuses to capture with a
// caption that breaks these rules.

export const SAFE = {
  en: /\bsafe(ly)?\b/i, de: /\bsicher(e|er|es|en|em)?\b/i, fr: /(^|[^\p{L}])sûr(e|es|s)?($|[^\p{L}])/iu, es: /\bsegur[oa]s?\b/i, it: /\bsicur[oaie]\b/i,
  nl: /\bveilig(e)?\b/i, pl: /(^|[^\p{L}])bezpieczn\p{L}*/iu, cs: /(^|[^\p{L}])bezpečn\p{L}*/iu, sl: /(^|[^\p{L}])(varn\p{L}*|varen)($|[^\p{L}])/iu,
  pt: /\bsegur[oa]s?\b/i, ja: /安全[なにで]/, zh: /安全(的|登顶|时段|日|$|）)/, ko: /안전(한|하게)/,
}

// reliability, certainty and accuracy claims
export const CLAIMS = {
  en: /\b(reliab\w*|sure|certain\w*|accura\w*|precis\w*)\b/i,
  de: /(zuverlässig|verlässlich|sicherheit|gewiss|genau|präzis)/i,
  fr: /(fiab\p{L}*|certitude|certain\p{L}*|précis\p{L}*|exact\p{L}*)/iu,
  es: /(fiab\p{L}*|confiab\p{L}*|certez\p{L}*|precis\p{L}*|exact\p{L}*)/iu,
  it: /(affidabil\p{L}*|certezz\p{L}*|sicurezz\p{L}*|precis\p{L}*|esatt\p{L}*)/iu,
  nl: /(betrouwba\p{L}*|zeker\p{L}*|nauwkeurig\p{L}*|precie\p{L}*)/iu,
  pl: /(niezawodn\p{L}*|wiarygodn\p{L}*|pewn\p{L}*|dokładn\p{L}*|precyzyjn\p{L}*)/iu,
  cs: /(spolehliv\p{L}*|jist\p{L}*|přesn\p{L}*)/iu,
  sl: /(zanesljiv\p{L}*|gotov\p{L}*|natančn\p{L}*|točn\p{L}*)/iu,
  pt: /(confiáv\p{L}*|fiab\p{L}*|certez\p{L}*|cert[oa]s?\b|precis\p{L}*|exat\p{L}*)/iu,
  ja: /(信頼|確か|確実|正確|精度)/,
  zh: /(可靠|可信|确定|准确|精准|精确)/,
  ko: /(신뢰|확실|정확)/,
}

// words that also mean cheap: "günstig" in a headline reads as a bargain (the app's own texts keep it)
export const CHEAP = { en: /\b(cheap\w*|bargain)\b/i, de: /günstig/i }

// em and en dashes: the store texts use commas and full stops
export const DASH = /[—–]/

// every rule a caption breaks, as readable lines (empty: all good)
export function captionProblems(captions) {
  const out = []
  for (const [lang, list] of Object.entries(captions)) {
    list.forEach((text, i) => {
      const where = `${lang} screen ${i + 1}: "${text}"`
      if (DASH.test(text)) out.push(`${where} has a dash`)
      if (SAFE[lang]?.test(text)) out.push(`${where} promises safety`)
      if (CLAIMS[lang]?.test(text)) out.push(`${where} claims reliability or accuracy`)
      if (CHEAP[lang]?.test(text)) out.push(`${where} uses a word that also means cheap`)
      if (!SAFE[lang] || !CLAIMS[lang]) out.push(`${lang}: no word list for this language`)
    })
  }
  return out
}
