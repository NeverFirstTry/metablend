// One section, one name (UX review H3, owner: before launch): the app's tab said "Hiking", its page "Mountain
// weather", the website's menu "Hiking" and its footer "Mountains". Now every pack names it with the footer's word.
import { test } from 'node:test'
import assert from 'node:assert/strict'

const LANGS = ['en', 'de', 'fr', 'es', 'it', 'nl', 'pl', 'cs', 'sl', 'pt', 'ja', 'zh', 'ko']

test('the tab, the menu, the page title and the footer say the same word, in every language', async () => {
  for (const l of LANGS) {
    const p = (await import(`./i18n/${l}.js`)).default
    assert.equal(p.hiking, p.footerMountains, `${l}: tab and menu`)
    assert.equal(p.hikeTitle, p.footerMountains, `${l}: page title`)
    // the tester page names the tab it sends testers to
    assert.ok(p.testersTry2.startsWith(p.footerMountains), `${l}: testersTry2 starts with the tab's name`)
  }
})
