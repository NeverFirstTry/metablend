// What the feedback panel says after a send (owner, 2026-11-22): it showed the feedback route's English texts raw,
// in every language. Now a translated message by the route's answer; the route itself is unchanged.
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { feedbackResultKey } from './feedback-text.js'

const LANGS = ['en', 'de', 'fr', 'es', 'it', 'nl', 'pl', 'cs', 'sl', 'pt', 'ja', 'zh', 'ko']
const KEYS = ['fbThanks', 'fbThanksWeights', 'fbErrHour', 'fbErrNightSun', 'fbErrFar', 'fbErrCheck', 'fbErrSend']

test('each answer of the feedback route has its message', () => {
  assert.equal(feedbackResultKey({ status: 200, json: { message: 'Thank you! Feedback saved.' } }), 'fbThanks')
  assert.equal(feedbackResultKey({ status: 200, json: { message: 'Feedback saved. No forecasts to compare yet.' } }), 'fbThanks')
  assert.equal(feedbackResultKey({ status: 200, json: { message: 'Thank you! Weights updated.', weights: { a: 1 } } }), 'fbThanksWeights')
  assert.equal(feedbackResultKey({ status: 429, json: { error: 'You have already submitted feedback for this city in the last hour.' } }), 'fbErrHour')
  // the route's 422: sunny at night (checked first, by the place's clock), or a temperature far off the forecast
  assert.equal(feedbackResultKey({ status: 422, json: { error: 'x' }, sunnyAtNight: true }), 'fbErrNightSun')
  assert.equal(feedbackResultKey({ status: 422, json: { error: 'x' }, sunnyAtNight: false }), 'fbErrFar')
  assert.equal(feedbackResultKey({ status: 400, json: { error: 'Invalid temperature' } }), 'fbErrCheck')
  assert.equal(feedbackResultKey({ status: 500, json: { error: 'No API weights found' } }), 'fbErrSend')
  assert.equal(feedbackResultKey({ status: 403, json: { error: 'Forbidden' } }), 'fbErrSend')
  assert.equal(feedbackResultKey({ status: 200, json: { error: 'odd' } }), 'fbErrSend', 'an error in a 200 is still an error')
  assert.equal(feedbackResultKey(null), 'fbErrSend', 'no answer at all (offline)')
})

// source-match-ok: the panel sends and shows the message after a click, which a static render cannot drive
test('the panel shows the translated message, never the route\'s text or an English fallback', () => {
  const panel = readFileSync(new URL('../app/components/outlook/FeedbackPanel.jsx', import.meta.url), 'utf8')
  assert.doesNotMatch(panel, /msg: json\.(error|message)/)
  assert.doesNotMatch(panel, /'Error sending feedback\.'/)
  assert.match(panel, /feedbackResultKey\(/)
})

test('the messages in every language', async () => {
  for (const l of LANGS) {
    const p = (await import(`./i18n/${l}.js`)).default
    assert.deepEqual(KEYS.filter(k => !p[k]), [], l)
    assert.ok(p.fbErrNightSun.includes('{cond}'), `${l}: fbErrNightSun names the condition`)
  }
})
