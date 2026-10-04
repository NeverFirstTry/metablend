import { test } from 'node:test'
import assert from 'node:assert/strict'
import { pathFromAppUrl, isSitePath } from './deep-link.js'

test('pathFromAppUrl — the app’s own links, decoded once', () => {
  assert.equal(pathFromAppUrl('metablend://open?path=%2F%3Fcity%3DLienz'), '/?city=Lienz')
  assert.equal(pathFromAppUrl('metablend://open?path=%2F%3Fcity%3DSankt%2520P%25C3%25B6lten'), '/?city=Sankt%20P%C3%B6lten')
  assert.equal(pathFromAppUrl('metablend://open?path=%2Fhike%3Flat%3D46.789%26lon%3D12.861%26elev%3D2681%26name%3DHochstadel'), '/hike?lat=46.789&lon=12.861&elev=2681&name=Hochstadel')
  assert.equal(pathFromAppUrl('metablend://open?path=/more'), '/more')
})

test('pathFromAppUrl — anything else is ignored', () => {
  for (const bad of ['https://evil.example/?path=/x', 'metablend://other?path=/x', 'metablend://open?path=//evil.example',
    'metablend://open?path=https://evil.example', 'metablend://open', 'metablend://open?path=/%5Cevil', 'not a url', '', null]) {
    assert.equal(pathFromAppUrl(bad), null, String(bad))
  }
})

test('pathFromAppUrl — tabs and line breaks can\'t sneak in another site (URL parsing drops them)', () => {
  for (const sneaky of ['metablend://open?path=/%09/evil.com', 'metablend://open?path=/%0A/evil.com', 'metablend://open?path=/%0D%0A/evil.com', 'metablend://open?path=/%00/x']) {
    assert.equal(pathFromAppUrl(sneaky), null, sneaky)
  }
})

test('isSitePath — a path on metablend.app, nothing that resolves elsewhere', () => {
  for (const ok of ['/', '/more', '/?city=Lienz', '/hike?peak=grossglockner']) assert.equal(isSitePath(ok), true, ok)
  for (const bad of ['//evil.com', '/\t/evil.com', '/\\evil.com', 'https://evil.com', 'evil', '', null, 42]) assert.equal(isSitePath(bad), false, String(bad))
})
