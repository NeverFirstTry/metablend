// The browser tab's title in the reader's language (owner, 2026-11-22: Rankings and every other page kept its English
// title). Pages keep their English title on the server, for search engines and English readers; for the 12 other
// languages the page's own title is set in the browser (app/components/DocTitle.jsx, the start page, More).
import { useLayoutEffect } from 'react'
import { t } from './i18n.js'
import { fill } from './outlook/text.js'

// a page's title as the layout's template writes it ('%s · MetaBlend', lib/site-metadata.js)
export const pageTitle = (lang, key, vars = {}) => `${fill(t(lang, key), vars)} · MetaBlend`
// the start page's, as lib/landing.js writes it for /de, /fr, ...
export const homeTitle = lang => `MetaBlend · ${t(lang, 'landingMetaTitle')}`
// the title to set, or null: an English reader keeps the server's
export const readerTitle = (lang, title) => (lang === 'en' ? null : title)

// Keeps the title while the page is open. Next puts its own <title> back once the page has hydrated, after the first
// effects (measured 2026-11-22 on More: set at 66 ms, back at 83 ms), so it is set again whenever it changes back. A
// layout effect: leaving the page disconnects in the same commit (pending records dropped), so the next page keeps its
// own title. null: nothing is touched.
export function useDocTitle(title) {
  useLayoutEffect(() => {
    if (!title) return
    const keep = () => { if (document.title !== title) document.title = title }
    keep()
    const watch = new MutationObserver(keep)
    watch.observe(document.head, { subtree: true, childList: true, characterData: true })
    return () => watch.disconnect()
  }, [title])
}
