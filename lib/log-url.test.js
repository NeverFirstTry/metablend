import { test } from 'node:test'
import assert from 'node:assert/strict'
import fs from 'node:fs'
import { loggedUrl } from './log-url.js'

test('loggedUrl — the phone\'s position (near) is dropped, other coordinates kept to one decimal (about 10 km)', () => {
  assert.equal(loggedUrl('https://metablend.app/api/forecast?city=Wien&lang=de&near=48.2,16.4'), 'https://metablend.app/api/forecast?city=Wien&lang=de')
  assert.equal(loggedUrl('https://metablend.app/api/peaks/near?lat=46.8512&lon=12.7534'), 'https://metablend.app/api/peaks/near?lat=46.9&lon=12.8')
  assert.equal(loggedUrl('https://metablend.app/api/hike?lat=47.074&lon=12.694&elev=3798&name=Gro%C3%9Fglockner'), 'https://metablend.app/api/hike?lat=47.1&lon=12.7&elev=3798&name=Gro%C3%9Fglockner')
  assert.equal(loggedUrl('not a url'), null)
  assert.equal(loggedUrl(undefined), null)
})

test('withErrorLog logs the stripped URL, never the raw one', () => {
  assert.match(fs.readFileSync(new URL('./log.js', import.meta.url), 'utf8'), /url: loggedUrl\(request\?\.url\)/)
})
