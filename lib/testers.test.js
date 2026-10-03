import { test } from 'node:test'
import assert from 'node:assert/strict'
import { TESTERS, feedbackMailto, channelOpen, TESTER_KEYS, osLabel } from './testers.js'
import { t } from './i18n.js'

test('feedbackMailto — to info@, subject with platform, version and language, device line in the body', () => {
  const url = feedbackMailto({ version: '1.0 (3)', platform: 'android', os: 'Android 14', lang: 'de' })
  assert.match(url, /^mailto:info@metablend\.app\?subject=/)
  const q = new URLSearchParams(url.split('?')[1])
  assert.equal(q.get('subject'), 'MetaBlend feedback (android 1.0 (3), de)')
  assert.match(q.get('body'), /Android 14/)
  assert.equal(new URLSearchParams(feedbackMailto({ platform: 'web', lang: 'en' }).split('?')[1]).get('subject'), 'MetaBlend feedback (web, en)')
})

test('channelOpen — Android needs the group and the opt-in link, iPhone the TestFlight link', () => {
  assert.equal(channelOpen({ androidGroup: null, androidOptIn: null, testflight: null }, 'android'), false)
  assert.equal(channelOpen({ androidGroup: 'https://groups.google.com/g/x', androidOptIn: null, testflight: null }, 'android'), false)
  assert.equal(channelOpen({ androidGroup: 'https://groups.google.com/g/x', androidOptIn: 'https://play.google.com/apps/testing/app.metablend', testflight: null }, 'android'), true)
  assert.equal(channelOpen({ testflight: 'https://testflight.apple.com/join/abc' }, 'ios'), true)
  assert.ok('androidGroup' in TESTERS && 'androidOptIn' in TESTERS && 'testflight' in TESTERS)
})

test('every tester text exists (English here; parity.test.js covers the other 12)', () => {
  for (const k of TESTER_KEYS) assert.notEqual(t('en', k), k, k)
})

test('osLabel — the phone OS from the user agent, empty when unknown', () => {
  assert.equal(osLabel('Mozilla/5.0 (Linux; Android 14; SM-A528B) AppleWebKit/537.36 MetaBlendApp'), 'Android 14')
  assert.equal(osLabel('Mozilla/5.0 (iPhone; CPU iPhone OS 17_5 like Mac OS X) AppleWebKit/605.1.15'), 'iOS 17.5')
  assert.equal(osLabel('Mozilla/5.0 (Windows NT 10.0; Win64; x64) Firefox/131.0'), '')
})
