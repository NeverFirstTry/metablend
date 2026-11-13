import { test } from 'node:test'
import assert from 'node:assert/strict'
import fs from 'node:fs'

// the launch-day switch (lib/hike/stores.js): one module instance per setting, through a query on the import
const load = async (env, tag) => {
  const keep = { ...process.env }
  delete process.env.NEXT_PUBLIC_STORE_BADGES; delete process.env.NEXT_PUBLIC_APP_STORE_URL
  Object.assign(process.env, env)
  try { return (await import(`./stores.js?${tag}`)).STORES } finally { process.env = keep }
}

test('stores — off unless NEXT_PUBLIC_STORE_BADGES is "on"; the App Store only with its URL', async () => {
  assert.deepEqual(await load({}, 'unset'), { ios: null, android: null })
  assert.deepEqual(await load({ NEXT_PUBLIC_STORE_BADGES: 'true', NEXT_PUBLIC_APP_STORE_URL: 'https://apps.apple.com/app/id1' }, 'true'), { ios: null, android: null })
  assert.deepEqual(await load({ NEXT_PUBLIC_STORE_BADGES: 'on' }, 'on'), { ios: null, android: 'https://play.google.com/store/apps/details?id=app.metablend' })
  assert.deepEqual(await load({ NEXT_PUBLIC_STORE_BADGES: 'on', NEXT_PUBLIC_APP_STORE_URL: 'https://apps.apple.com/app/id1' }, 'both'),
    { ios: 'https://apps.apple.com/app/id1', android: 'https://play.google.com/store/apps/details?id=app.metablend' })
})

test('badges — both stores\' own files in all 13 languages (app/components/OfficialBadges.jsx)', () => {
  for (const lang of ['en', 'de', 'fr', 'es', 'it', 'nl', 'pl', 'cs', 'sl', 'pt', 'ja', 'zh', 'ko']) {
    const apple = fs.readFileSync(`public/badges/app-store-${lang}.svg`, 'utf8')
    assert.match(apple, /^<svg[^>]* height="40"/, `app-store-${lang}.svg`)
    assert.match(apple, /<title>Download_on_the_App_Store_Badge_/, `app-store-${lang}.svg is Apple's`)
    const google = fs.readFileSync(`public/badges/google-play-${lang}.png`)
    assert.equal(google.toString('latin1', 1, 4), 'PNG', `google-play-${lang}.png`)
  }
})
