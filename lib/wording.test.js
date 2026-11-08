// We never promise safety. A weather window, a start time or a day is
// "favourable", not "safe". Warnings and the "not a safety guarantee" and
// "not for safety-critical decisions" disclaimers keep their words.
import test from 'node:test'
import assert from 'node:assert/strict'
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const ROOT = path.join(path.dirname(fileURLToPath(import.meta.url)), '..')
const SAFE = {
  en: /\bsafe(ly)?\b/i, de: /\bsicher(e|er|es|en|em)?\b/i, fr: /(^|[^\p{L}])sûr(e|es|s)?($|[^\p{L}])/iu, es: /\bsegur[oa]s?\b/i, it: /\bsicur[oaie]\b/i,
  nl: /\bveilig(e)?\b/i, pl: /(^|[^\p{L}])bezpieczn\p{L}*/iu, cs: /(^|[^\p{L}])bezpečn\p{L}*/iu, sl: /(^|[^\p{L}])(varn\p{L}*|varen)($|[^\p{L}])/iu,
  pt: /\bsegur[oa]s?\b/i, ja: /安全[なにで]/, zh: /安全(的|登顶|时段|日|$|）)/, ko: /안전(한|하게)/,
}
// the keys allowed to use the word: warnings and the disclaimers saying we are no guarantee
const ALLOWED_KEYS = new Set(['warningStorm', 'hikeDisclaimer', 'betaDisclaimer', 'footerData', 'weatherApiNote'])
const LOCALES = {
  en: ['en-US'], de: ['de-DE'], fr: ['fr-FR'], es: ['es-ES'], it: ['it', 'it-IT'], nl: ['nl-NL'], pl: ['pl', 'pl-PL'], cs: ['cs', 'cs-CZ'],
  sl: ['sl'], pt: ['pt-BR'], ja: ['ja', 'ja-JP'], zh: ['zh-Hans', 'zh-CN'], ko: ['ko', 'ko-KR'],
}

test('the app promises no safety: no pack calls a window, start or day safe', async () => {
  for (const lang of Object.keys(SAFE)) {
    const { default: pack } = await import(`./i18n/${lang}.js`)
    for (const [key, text] of Object.entries(pack)) {
      if (!ALLOWED_KEYS.has(key) && typeof text === 'string') assert.doesNotMatch(text, SAFE[lang], `${lang}.${key}: ${text}`)
    }
  }
})

test('the store listings and screenshot captions promise no safety either', () => {
  const captions = JSON.parse(fs.readFileSync(path.join(ROOT, 'store/captions.json'), 'utf8'))
  for (const [lang, list] of Object.entries(captions)) {
    assert.doesNotMatch(list[3], SAFE[lang], `caption ${lang}`)
  }
  for (const [lang, locales] of Object.entries(LOCALES)) {
    for (const locale of locales) {
      for (const file of [`fastlane/metadata/${locale}/description.txt`, `fastlane/metadata/${locale}/promotional_text.txt`, `fastlane/metadata/android/${locale}/full_description.txt`, `fastlane/metadata/android/${locale}/short_description.txt`]) {
        const full = path.join(ROOT, file)
        if (!fs.existsSync(full)) continue
        for (const line of fs.readFileSync(full, 'utf8').split('\n')) {
          // the disclaimer line names MetaBlend and says it is no guarantee
          if (!line.includes('MetaBlend')) assert.doesNotMatch(line, SAFE[lang], `${file}: ${line}`)
          else if (line.startsWith('•')) assert.doesNotMatch(line, SAFE[lang], `${file}: ${line}`)
        }
        assert.doesNotMatch(fs.readFileSync(full, 'utf8').split('\n')[0], SAFE[lang], `${file}: first line`)
      }
    }
  }
})

test('the English page descriptions call the summit window favourable', () => {
  for (const f of ['app/hike/page.js', 'app/mountains/page.js', 'app/mountains/[peak]/page.js']) {
    const source = fs.readFileSync(path.join(ROOT, f), 'utf8')
    assert.doesNotMatch(source, /safe summit window/, f)
    assert.match(source, /favourable summit window/, f)
  }
})

test('warnings keep their words', async () => {
  const { default: en } = await import('./i18n/en.js')
  const { default: de } = await import('./i18n/de.js')
  assert.match(en.warningStorm, /Stay safe/)
  assert.match(en.hikeDisclaimer, /not a safety guarantee/)
  assert.match(de.hikeDisclaimer, /keine Sicherheitsgarantie/)
})
