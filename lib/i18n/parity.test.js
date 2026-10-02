import { test } from 'node:test'
import assert from 'node:assert/strict'
import { LANGUAGES } from '../i18n.js'

const packs = Object.fromEntries(await Promise.all(LANGUAGES.map(async ({ code }) => [code, (await import(`./${code}.js`)).default])))
const holes = s => [...String(s).matchAll(/\{(\w+)\}/g)].map(m => m[1]).sort().join(',')
// plural extras exist only where the language needs them
const PLURAL = /(One|Two|Few|Many)$/

test('every language has exactly the English texts, with the same {placeholders}', () => {
  const en = packs.en
  const base = Object.keys(en).filter(k => !PLURAL.test(k) || k.endsWith('One'))
  for (const { code } of LANGUAGES) {
    const p = packs[code]
    const missing = base.filter(k => !(k in p) && !k.endsWith('One'))
    assert.deepEqual(missing, [], `${code} misses ${missing.join(', ')}`)
    const extra = Object.keys(p).filter(k => !(k in en) && !PLURAL.test(k))
    assert.deepEqual(extra, [], `${code} has unknown ${extra.join(', ')}`)
    for (const k of Object.keys(p)) {
      // a plural form may carry the singular's placeholders or the base text's
      // (Slovenian "one" also covers 101, so its …One text needs {n})
      const refs = [en[k], en[k.replace(PLURAL, '')]].filter(v => v != null)
      assert.ok(refs.some(r => holes(r) === holes(p[k])), `${code}.${k} placeholders`)
    }
  }
})
