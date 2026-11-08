// We never promise safety. A weather window, a start time or a day is
// "favourable", not "safe". Warnings and the "not a safety guarantee" and
// "not for safety-critical decisions" disclaimers keep their words.
import test from 'node:test'
import assert from 'node:assert/strict'
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { SAFE, captionProblems } from './wording.js'

const ROOT = path.join(path.dirname(fileURLToPath(import.meta.url)), '..')
// the keys allowed to use the word: warnings and the disclaimers saying we are no guarantee
const ALLOWED_KEYS = new Set(['warningStorm', 'hikeDisclaimer', 'betaDisclaimer', 'footerData'])
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
  // every caption: no dash, no safety, no reliability or accuracy claim, no word that also means cheap
  assert.deepEqual(captionProblems(captions), [])
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
