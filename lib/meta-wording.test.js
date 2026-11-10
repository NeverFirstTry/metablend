// What search results and link previews show, as the pages write it: every page type's title (with the
// layout's template, as Next.js applies it), description, Open Graph and Twitter texts and image alt, in
// every language a page has (the landing pages and shared-city previews in all 13). The wording rules of
// lib/wording.test.js hold there too: no em or en dash, no safety promise (owner, 2026-11-10).
import './test-jsx-hooks.js'
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { SAFE } from './wording.js'

const { siteMetadata } = await import('./site-metadata.js')
const { LANGUAGES } = await import('./i18n.js')
const { LANDING_LANGS } = await import('./landing.js')
const CODES = LANGUAGES.map(l => l.code)
const TEMPLATE = siteMetadata.title.template

// the texts a metadata object puts into tags; a page title goes through the layout's template
const texts = (meta, { layout = false } = {}) => {
  const title = meta.title
  const shown = typeof title === 'string' ? (layout ? title : TEMPLATE.replace('%s', title)) : title?.absolute ?? title?.default
  return [shown, meta.description, meta.openGraph?.title, meta.openGraph?.description, meta.twitter?.title, meta.twitter?.description,
    meta.appleWebApp?.title, ...(meta.openGraph?.images ?? []).map(i => i.alt)].filter(s => typeof s === 'string')
}
const check = (where, lang, list) => {
  assert.ok(list.length, `${where}: no meta texts found`)
  for (const s of list) {
    assert.doesNotMatch(s, /[—–]/, `${where} (${lang}): dash in "${s}"`)
    assert.doesNotMatch(s, SAFE[lang], `${where} (${lang}): safety word in "${s}"`)
  }
}
const params = p => ({ params: Promise.resolve(p), searchParams: Promise.resolve({}) })

test('site-wide metadata and the preview image alt texts', async () => {
  check('layout', 'en', [...texts(siteMetadata, { layout: true }), siteMetadata.title.default])
  check('og image', 'en', [(await import('../app/opengraph-image.js')).alt, (await import('../app/[lang]/opengraph-image.js')).alt])
})

test('every page with fixed metadata', async () => {
  const pages = ['aviation/page.js', 'hike/page.js', 'impressum/page.js', 'leaderboard/layout.js', 'more/page.js', 'mountains/page.js', 'not-found.js',
    'planner/layout.js', 'privacy/page.js', 'support/page.js', 'terms/page.js', 'testers/page.js', 'weather/page.js', 'heatmap/layout.js']
  for (const p of pages) check(p, 'en', texts((await import(`../app/${p}`)).metadata))
})

test('pages that build their metadata: a city, a summit, an airport', async () => {
  check('weather/[city]', 'en', texts(await (await import('../app/weather/[city]/page.js')).generateMetadata(params({ city: 'vienna' }))))
  check('mountains/[peak]', 'en', texts(await (await import('../app/mountains/[peak]/page.js')).generateMetadata(params({ peak: 'grossglockner' }))))
  const airport = await import('../app/aviation/[icao]/page.js')
  check('aviation/[icao]', 'en', texts(await airport.generateMetadata(params({ icao: 'loww' }))))
  check('aviation/[icao] unknown', 'en', texts(await airport.generateMetadata(params({ icao: 'zzzz' }))))
})

test('the landing pages and the shared-city previews in all 13 languages', async () => {
  const { generateMetadata: landing } = await import('../app/[lang]/page.js')
  for (const lang of LANDING_LANGS) check(`/${lang}`, lang, texts(await landing(params({ lang }))))
  const { generateMetadata: shared } = await import('../app/city/[name]/page.js')
  for (const lang of CODES) check('city/[name]', lang, texts(await shared({ params: Promise.resolve({ name: 'Wien' }), searchParams: Promise.resolve({ lang }) })))
})
