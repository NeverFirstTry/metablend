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
const ALLOWED_KEYS = new Set(['warningStorm', 'hikeDisclaimer', 'forecastDisclaimer', 'footerData', 'weatherApiNote', 'supportQ5', 'supportA5'])
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

// UI copy uses full stops and commas, never an em or en dash; a range takes a plain hyphen (owner, 2026-11-09)
test('no pack string contains an em or en dash', async () => {
  for (const lang of Object.keys(SAFE)) {
    const { default: pack } = await import(`./i18n/${lang}.js`)
    for (const [key, text] of Object.entries(pack)) if (typeof text === 'string') assert.doesNotMatch(text, /[—–]/, `${lang}.${key}: ${text}`)
  }
})

// Ranges built in code ("2-5°", "15:00-21:00") take a plain hyphen too, like the packs: no en dash next to a
// number or a template value anywhere in lib/ or app/ (the lone "–" for a missing value stays).
test('no code builds a range with an en dash', () => {
  const SKIP = new Set(['i18n', 'privacy', 'terms', 'impressum', 'node_modules', '__fixtures__'])
  const files = dir => fs.readdirSync(dir, { withFileTypes: true }).flatMap(e => {
    const p = `${dir}/${e.name}`
    return e.isDirectory() ? (SKIP.has(e.name) ? [] : files(p)) : /\.(jsx?|mjs)$/.test(e.name) && !/\.test\./.test(e.name) ? [p] : []
  })
  const hits = []
  for (const f of [...files('lib'), ...files('app')]) {
    fs.readFileSync(f, 'utf8').split(/\r?\n/).forEach((line, i) => {
      const code = line.replace(/(^|\s)\/\/.*$/, '').replace(/\/\*.*?\*\//g, '') // comments are not copy
      if (/[}\d]\s?–|–\s?[${\d]/.test(code)) hits.push(`${f}:${i + 1}: ${line.trim()}`)
    })
  }
  assert.deepEqual(hits, [])
})

// The forecast disclaimer (Rankings, Heatmap, Planner, the home page): one calm sentence in every pack, no beta
// or work-in-progress wording, and a quiet component without the old amber construction banner (owner, 2026-11-09).
test('the forecast disclaimer has no beta wording, in any pack or in its component', async () => {
  for (const lang of Object.keys(SAFE)) {
    const { default: pack } = await import(`./i18n/${lang}.js`)
    assert.ok(pack.forecastDisclaimer, `${lang}: forecastDisclaimer`)
    assert.doesNotMatch(pack.forecastDisclaimer, /beta|ベータ|测试版|베타|Entwicklung|progress|experiment/i, `${lang}: ${pack.forecastDisclaimer}`)
    assert.equal(pack.betaDisclaimer, undefined, `${lang}: the old key is gone`)
  }
  assert.equal(fs.existsSync('app/components/BetaBanner.jsx'), false)
  assert.doesNotMatch(fs.readFileSync('app/components/Disclaimer.jsx', 'utf8'), /beta|Construction|amber/i)
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
  // source-match-ok: the page copy itself is the subject: favourable, never safe
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
